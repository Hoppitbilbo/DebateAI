package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// ---------- overview ----------

func (s *Server) handleAdminOverview(w http.ResponseWriter, r *http.Request) {
	b := s.Settings.Budget()
	spend := s.Gateway.MonthSpend()
	today := time.Now().UTC().Truncate(24 * time.Hour).Format(time.RFC3339)
	writeJSON(w, 200, adminOverviewResponse{
		Users: userCounts{
			Admin:   s.Users.Count(domain.RoleAdmin),
			Teacher: s.Users.Count(domain.RoleTeacher),
			Student: s.Users.Count(domain.RoleStudent),
		},
		Classes:         s.Classes.CountActive(),
		Assignments:     s.Assignments.Count(),
		Sessions:        s.Sessions.CountWithTurns(),
		PendingInvites:  s.Invites.CountPending(),
		Providers:       s.Providers.Count(true),
		MonthSpendUSD:   spend,
		TodaySpendUSD:   s.Usage.SpendSince(today),
		MonthBudgetUSD:  b.MonthlyUSD,
		BudgetExceeded:  s.Gateway.BudgetExceeded(),
		RequestsToday:   s.Usage.CountSince(today, false),
		ErrorsToday:     s.Usage.CountSince(today, true),
		MailConfigured:  s.Settings.MailConfigured(),
		RoutingComplete: len(s.Settings.Routing().Tasks[app.TaskChat]) > 0,
	})
}

// ---------- users ----------

func (s *Server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	if !domain.ValidRole(role) {
		role = ""
	}
	users, err := s.Users.Search(strings.TrimSpace(r.URL.Query().Get("q")), role, maxListedUsers)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	type userOut struct {
		*domain.User
		Classes int     `json:"classes"`
		CostUSD float64 `json:"costUsd"`
	}
	out := []userOut{}
	for i := range users {
		out = append(out, userOut{User: &users[i]})
	}
	for i := range out {
		out[i].Classes = s.Classes.CountMemberships(out[i].ID)
		out[i].CostUSD = s.Usage.UserSpendSince(out[i].ID, app.MonthStart())
	}
	writeJSON(w, 200, out)
}

func (s *Server) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email, Name, Password, Role, Locale string
		ClassID                             *int64 `json:"classId"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if in.Password == "" {
		writeErr(w, 400, "bad_request", "password required (or use invites)")
		return
	}
	id, err := s.Accounts.CreateUser(in.Email, in.Name, in.Password, in.Role, in.Locale)
	if err != nil {
		writeServiceErr(w, err)
		return
	}
	if in.ClassID != nil {
		role := "student"
		if in.Role != "student" {
			role = "teacher"
		}
		if err := s.Classes.AddMember(*in.ClassID, id, role); err != nil {
			writeErr(w, 500, "internal", err.Error())
			return
		}
	}
	u, _ := s.getUser(id)
	writeJSON(w, 201, u)
}

func (s *Server) handleUpdateUser(w http.ResponseWriter, r *http.Request) {
	me := currentUser(r)
	id := pathID(r, "id")
	var in struct {
		Name     *string `json:"name"`
		Role     *string `json:"role"`
		Active   *bool   `json:"active"`
		Locale   *string `json:"locale"`
		Password *string `json:"password"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if id == me.ID && ((in.Role != nil && *in.Role != "admin") || (in.Active != nil && !*in.Active)) {
		writeErr(w, 400, "self_lockout", "you cannot demote or disable yourself")
		return
	}
	p := domain.UserPatch{Active: in.Active}
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		p.Name = ptr(strings.TrimSpace(*in.Name))
	}
	if in.Role != nil && domain.ValidRole(*in.Role) {
		p.Role = in.Role
	}
	if in.Locale != nil {
		p.Locale = ptr(app.NormLocale(*in.Locale))
	}
	err := s.Users.Update(id, p)
	if err == nil && in.Active != nil && !*in.Active {
		err = s.Logins.DeleteForUser(id) // a disabled account is logged out everywhere
	}
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	if in.Password != nil && *in.Password != "" {
		if err := s.Accounts.SetPassword(id, *in.Password); err != nil {
			writeServiceErr(w, err)
			return
		}
	}
	u, err := s.getUser(id)
	if err != nil {
		writeErr(w, 404, "not_found", "user not found")
		return
	}
	writeJSON(w, 200, u)
}

func (s *Server) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	if pathID(r, "id") == currentUser(r).ID {
		writeErr(w, 400, "self_delete", "you cannot delete yourself")
		return
	}
	if err := s.Users.Delete(pathID(r, "id")); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
}

// ---------- invites ----------

func (s *Server) handleListInvites(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, s.Invites.ListAll(maxListedInvites))
}

func (s *Server) handleCreateInvites(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var in struct {
		Emails  []string `json:"emails"`
		Role    string   `json:"role"`
		ClassID *int64   `json:"classId"`
		Locale  string   `json:"locale"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	className := ""
	if in.ClassID != nil {
		className = s.Classes.Name(*in.ClassID)
	}
	locale := in.Locale
	if locale == "" {
		locale = u.Locale
	}
	results := []app.InviteResult{}
	for _, e := range app.SplitEmails(in.Emails) {
		if _, err := s.getUserByEmail(e); err == nil && in.ClassID == nil {
			results = append(results, app.InviteResult{Email: e, Status: "error", Error: "already registered"})
			continue
		}
		inv, err := s.Accounts.CreateInvite(app.Invitation{Inviter: u, Email: e, Role: in.Role, ClassID: in.ClassID, ClassName: className, Locale: locale}, s.baseURL(r))
		if err != nil {
			results = append(results, app.InviteResult{Email: e, Status: "error", Error: err.Error()})
			continue
		}
		results = append(results, app.InvitedResult(inv))
	}
	writeJSON(w, 200, inviteResultsResponse{Results: results})
}

func (s *Server) handleResendInvite(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := pathID(r, "id")
	old, err := s.Invites.Get(id)
	if err != nil {
		writeErr(w, 404, "not_found", "invite not found")
		return
	}
	if err := s.Invites.Delete(id); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	inv, err := s.Accounts.CreateInvite(app.Invitation{Inviter: u, Email: old.Email, Role: old.Role, ClassID: old.ClassID, ClassName: old.ClassName, Locale: old.Locale}, s.baseURL(r))
	if err != nil {
		writeServiceErr(w, err)
		return
	}
	writeJSON(w, 200, inv)
}

func (s *Server) handleDeleteInvite(w http.ResponseWriter, r *http.Request) {
	if err := s.Invites.Delete(pathID(r, "id")); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
}

// ---------- settings ----------

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	smtp := s.Settings.SMTP()
	hasPw := smtp.Password != ""
	smtp.Password = ""
	writeJSON(w, 200, settingsResponse{
		General:         s.Settings.General(),
		SMTP:            smtp,
		SMTPHasPassword: hasPw,
		Budget:          s.Settings.Budget(),
		Routing:         s.Settings.Routing(),
		Jev:             s.Settings.Jev(),
		Tasks:           app.AllTasks,
	})
}

func (s *Server) handlePutSetting(w http.ResponseWriter, r *http.Request) {
	var err error
	switch r.PathValue("key") {
	case app.SettingGeneral:
		v := app.DefaultGeneral()
		if err = readJSON(r, &v); err == nil {
			err = s.Settings.SaveGeneral(v)
		}
	case app.SettingSMTP:
		var v app.SMTPSettings
		if err = readJSON(r, &v); err == nil {
			err = s.Settings.SaveSMTP(v)
		}
	case app.SettingBudget:
		var v app.BudgetSettings
		if err = readJSON(r, &v); err == nil {
			err = s.Settings.SaveBudget(v)
		}
	case app.SettingRouting:
		var v app.RoutingSettings
		if err = readJSON(r, &v); err == nil {
			err = s.Settings.SaveRouting(v)
		}
	case app.SettingJev:
		v := app.DefaultJev()
		if err = readJSON(r, &v); err == nil {
			err = s.Settings.SaveJev(v)
		}
	default:
		writeErr(w, 404, "not_found", "unknown setting")
		return
	}
	if err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	s.handleGetSettings(w, r)
}

func (s *Server) handleSMTPTest(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var in struct{ To string }
	_ = readJSON(r, &in)
	if in.To == "" {
		in.To = u.Email
	}
	subj, body := app.RenderMail("test", u.Locale, map[string]string{"site": s.Settings.General().SiteName})
	if err := s.Mailer.SendMail(in.To, subj, body); err != nil {
		writeErr(w, 502, "smtp_error", err.Error())
		return
	}
	writeOK(w)
}

// ---------- providers ----------

// writeProviderErr: setup problems are the admin's to fix (400), failures of
// the upstream call are the provider's (502).
func writeProviderErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, app.ErrProviderNotFound):
		writeErr(w, 404, "not_found", err.Error())
	case errors.Is(err, app.ErrProviderSetup):
		writeErr(w, 400, "provider_error", err.Error())
	default:
		writeErr(w, 502, "provider_error", err.Error())
	}
}

func (s *Server) handleListProviders(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, s.Gateway.ProviderViews())
}

func (s *Server) handleCreateProvider(w http.ResponseWriter, r *http.Request) {
	var in app.NewProvider
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	p, err := s.Gateway.AddProvider(r.Context(), in)
	switch {
	case errors.Is(err, app.ErrBadProvider):
		writeErr(w, 400, "bad_request", err.Error())
		return
	case err != nil:
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 201, p)
}

func (s *Server) handleUpdateProvider(w http.ResponseWriter, r *http.Request) {
	var in app.ProviderChange
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	p, err := s.Gateway.UpdateProvider(pathID(r, "id"), in)
	switch {
	case errors.Is(err, app.ErrProviderNotFound):
		writeErr(w, 404, "not_found", err.Error())
		return
	case err != nil:
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, p)
}

func (s *Server) handleDeleteProvider(w http.ResponseWriter, r *http.Request) {
	if err := s.Gateway.DeleteProvider(pathID(r, "id")); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
}

func (s *Server) handleRefreshModels(w http.ResponseWriter, r *http.Request) {
	models, err := s.Gateway.RefreshModels(r.Context(), pathID(r, "id"))
	if err != nil {
		writeProviderErr(w, err)
		return
	}
	writeJSON(w, 200, models)
}

func (s *Server) handleTestProvider(w http.ResponseWriter, r *http.Request) {
	var in struct{ Model string }
	if err := readJSON(r, &in); err != nil || in.Model == "" {
		writeErr(w, 400, "bad_request", "model required")
		return
	}
	res, err := s.Gateway.TestProvider(r.Context(), pathID(r, "id"), in.Model, currentUser(r).ID)
	if err != nil {
		writeProviderErr(w, err)
		return
	}
	writeJSON(w, 200, res)
}

// ---------- prices ----------

func (s *Server) handleListPrices(w http.ResponseWriter, r *http.Request) {
	out, err := s.Prices.List()
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, out)
}

func (s *Server) handlePutPrice(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ProviderID int64   `json:"providerId"`
		Model      string  `json:"model"`
		InputPerM  float64 `json:"inputPerM"`
		OutputPerM float64 `json:"outputPerM"`
		Delete     bool    `json:"delete"`
	}
	if err := readJSON(r, &in); err != nil || in.Model == "" {
		writeErr(w, 400, "bad_request", "providerId and model required")
		return
	}
	var err error
	if in.Delete {
		err = s.Prices.Delete(in.ProviderID, in.Model)
	} else {
		err = s.Prices.Put(in.ProviderID, in.Model, in.InputPerM, in.OutputPerM)
	}
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	s.handleListPrices(w, r)
}

// ---------- usage / costs ----------

func (s *Server) handleUsageSummary(w http.ResponseWriter, r *http.Request) {
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 || days > 366 {
		days = 30
	}
	since := time.Now().UTC().AddDate(0, 0, -days).Format(time.RFC3339)

	group := func(by domain.UsageGrouping) []domain.UsageAggregate {
		return s.Usage.Aggregate(since, by, maxUsageGroups)
	}
	writeJSON(w, 200, usageSummaryResponse{
		Days:          days,
		ByDay:         group(domain.UsageByDay),
		ByModel:       group(domain.UsageByModel),
		ByTask:        group(domain.UsageByTask),
		ByProvider:    group(domain.UsageByProvider),
		ByUser:        group(domain.UsageByUser),
		ByClass:       group(domain.UsageByClass),
		MonthSpendUSD: s.Gateway.MonthSpend(),
		Budget:        s.Settings.Budget(),
	})
}

func (s *Server) handleUsageLog(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	out, err := s.Usage.Recent(limit)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, out)
}
