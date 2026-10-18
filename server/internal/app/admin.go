package app

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// ---------- overview ----------

func (s *Server) handleAdminOverview(w http.ResponseWriter, r *http.Request) {
	b := s.Settings.Budget()
	spend := s.Gateway.monthSpend()
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
		BudgetExceeded:  s.Gateway.budgetExceeded(),
		RequestsToday:   s.Usage.CountSince(today, false),
		ErrorsToday:     s.Usage.CountSince(today, true),
		MailConfigured:  s.Settings.MailConfigured(),
		RoutingComplete: len(s.Settings.Routing().Tasks[TaskChat]) > 0,
	})
}

// ---------- users ----------

func (s *Server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	if !validRole(role) {
		role = ""
	}
	users, err := s.Users.Search(strings.TrimSpace(r.URL.Query().Get("q")), role, maxListedUsers)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	type userOut struct {
		*User
		Classes int     `json:"classes"`
		CostUSD float64 `json:"costUsd"`
	}
	out := []userOut{}
	for i := range users {
		out = append(out, userOut{User: &users[i]})
	}
	for i := range out {
		out[i].Classes = s.Classes.CountMemberships(out[i].ID)
		out[i].CostUSD = s.Usage.UserSpendSince(out[i].ID, monthStart())
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
	if in.Role != nil && validRole(*in.Role) {
		p.Role = in.Role
	}
	if in.Locale != nil {
		p.Locale = ptr(normLocale(*in.Locale))
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
	results := []inviteResult{}
	for _, e := range splitEmails(in.Emails) {
		if _, err := s.getUserByEmail(e); err == nil && in.ClassID == nil {
			results = append(results, inviteResult{Email: e, Status: "error", Error: "already registered"})
			continue
		}
		inv, err := s.Accounts.CreateInvite(Invitation{Inviter: u, Email: e, Role: in.Role, ClassID: in.ClassID, ClassName: className, Locale: locale}, s.baseURL(r))
		if err != nil {
			results = append(results, inviteResult{Email: e, Status: "error", Error: err.Error()})
			continue
		}
		results = append(results, invitedResult(inv))
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
	inv, err := s.Accounts.CreateInvite(Invitation{Inviter: u, Email: old.Email, Role: old.Role, ClassID: old.ClassID, ClassName: old.ClassName, Locale: old.Locale}, s.baseURL(r))
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
		Tasks:           AllTasks,
	})
}

func (s *Server) handlePutSetting(w http.ResponseWriter, r *http.Request) {
	var err error
	switch r.PathValue("key") {
	case settingGeneral:
		v := defaultGeneral()
		if err = readJSON(r, &v); err == nil {
			err = s.Settings.SaveGeneral(v)
		}
	case settingSMTP:
		var v SMTPSettings
		if err = readJSON(r, &v); err == nil {
			err = s.Settings.SaveSMTP(v)
		}
	case settingBudget:
		var v BudgetSettings
		if err = readJSON(r, &v); err == nil {
			err = s.Settings.SaveBudget(v)
		}
	case settingRouting:
		var v RoutingSettings
		if err = readJSON(r, &v); err == nil {
			err = s.Settings.SaveRouting(v)
		}
	case settingJev:
		v := defaultJev()
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
	subj, body := renderMail("test", u.Locale, map[string]string{"site": s.Settings.General().SiteName})
	if err := s.Mailer.sendMail(in.To, subj, body); err != nil {
		writeErr(w, 502, "smtp_error", err.Error())
		return
	}
	writeOK(w)
}

// ---------- providers ----------

func (s *Server) loadProviders() []providerRow {
	out := []providerRow{}
	for _, rec := range s.Providers.List() {
		p := providerRow{ID: rec.ID, Name: rec.Name, Kind: rec.Kind, BaseURL: rec.BaseURL, Models: rec.Models, Enabled: rec.Enabled, CreatedAt: rec.CreatedAt}
		// Never send the key: only whether it is set and a hint to recognise it.
		if key, err := s.Crypto.Decrypt(rec.APIKeyEnc); err == nil && key != "" {
			p.HasKey = true
			if len(key) > 8 {
				p.KeyHint = key[:3] + "…" + key[len(key)-4:]
			}
		}
		out = append(out, p)
	}
	return out
}

func (s *Server) handleListProviders(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, s.loadProviders())
}

func (s *Server) handleCreateProvider(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name, Kind, BaseURL, APIKey string
		Models                      []ai.ModelInfo `json:"models"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if strings.TrimSpace(in.Name) == "" || !ai.KnownKind(in.Kind) {
		writeErr(w, 400, "bad_request", "name and a valid kind are required")
		return
	}
	id, err := s.Gateway.insertProvider(strings.TrimSpace(in.Name), in.Kind, in.BaseURL, in.APIKey)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	// Fetch the full model list right away (OpenRouter, OpenCode, Gemini,
	// Ollama…); the preset list is only a fallback when listing fails.
	fetched := false
	ctx, cancel := context.WithTimeout(r.Context(), modelListTimeout)
	if cp, err := s.Gateway.provider(id); err == nil {
		if models, err := cp.p.ListModels(ctx); err == nil && len(models) > 0 {
			s.Gateway.storeModels(id, models)
			fetched = true
		}
	}
	cancel()
	if !fetched && len(in.Models) > 0 {
		s.Gateway.storeModels(id, in.Models)
	}
	s.Gateway.autoRoute(id, in.Kind)
	for _, p := range s.loadProviders() {
		if p.ID == id {
			writeJSON(w, 201, p)
			return
		}
	}
}

// storeModels saves the model list of a provider and imports the prices it
// publishes (e.g. OpenRouter), unless the admin has set them manually.
func (g *aiGateway) storeModels(providerID int64, models []ai.ModelInfo) {
	logIfErr("store models", g.providers.SetModels(providerID, models))
	for _, m := range models {
		if m.InputPerM != nil && m.OutputPerM != nil {
			logIfErr("import price", g.prices.Import(providerID, m.ID, *m.InputPerM, *m.OutputPerM))
		} else if m.Free {
			logIfErr("import price", g.prices.Import(providerID, m.ID, 0, 0))
		}
	}
}

func (s *Server) handleUpdateProvider(w http.ResponseWriter, r *http.Request) {
	id := pathID(r, "id")
	var in struct {
		Name    *string `json:"name"`
		BaseURL *string `json:"baseUrl"`
		APIKey  *string `json:"apiKey"`
		Enabled *bool   `json:"enabled"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	p := domain.ProviderPatch{Enabled: in.Enabled}
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		p.Name = ptr(strings.TrimSpace(*in.Name))
	}
	if in.BaseURL != nil {
		p.BaseURL = ptr(strings.TrimSpace(*in.BaseURL))
	}
	if in.APIKey != nil && *in.APIKey != "" {
		p.APIKeyEnc = ptr(s.Crypto.Encrypt(strings.TrimSpace(*in.APIKey)))
	}
	err := s.Providers.Update(id, p)
	s.Gateway.invalidateProvider(id)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	for _, p := range s.loadProviders() {
		if p.ID == id {
			writeJSON(w, 200, p)
			return
		}
	}
	writeErr(w, 404, "not_found", "provider not found")
}

func (s *Server) handleDeleteProvider(w http.ResponseWriter, r *http.Request) {
	id := pathID(r, "id")
	if err := s.Providers.Delete(id); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	s.Gateway.invalidateProvider(id)
	rt := s.Settings.Routing()
	for task, list := range rt.Tasks {
		kept := list[:0:0]
		for _, t := range list {
			if t.ProviderID != id {
				kept = append(kept, t)
			}
		}
		rt.Tasks[task] = kept
	}
	if err := s.Settings.SaveRouting(rt); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
}

func (s *Server) handleRefreshModels(w http.ResponseWriter, r *http.Request) {
	id := pathID(r, "id")
	s.Gateway.invalidateProvider(id)
	cp, err := s.Gateway.provider(id)
	if err != nil {
		writeErr(w, 400, "provider_error", err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), modelRefreshTimeout)
	defer cancel()
	models, err := cp.p.ListModels(ctx)
	if err != nil {
		writeErr(w, 502, "provider_error", err.Error())
		return
	}
	s.Gateway.storeModels(id, models)
	writeJSON(w, 200, models)
}

func (s *Server) handleTestProvider(w http.ResponseWriter, r *http.Request) {
	id := pathID(r, "id")
	var in struct{ Model string }
	if err := readJSON(r, &in); err != nil || in.Model == "" {
		writeErr(w, 400, "bad_request", "model required")
		return
	}
	s.Gateway.invalidateProvider(id)
	cp, err := s.Gateway.provider(id)
	if err != nil {
		writeErr(w, 400, "provider_error", err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), providerTestTimeout)
	defer cancel()
	start := time.Now()
	u := currentUser(r)
	entry := usageEntry{UserID: &u.ID, ProviderID: id, Provider: cp.name, Model: in.Model, Task: "test"}
	if d, ok := cp.p.(ai.Decider); ok {
		state := map[string]any{"conversation": []map[string]string{
			{"from": "student", "text": "Why did you invade Russia?"},
			{"from": "Napoleon", "text": "The Tsar broke the Continental System."},
		}}
		res, err := s.Gateway.meterDecider(d, entry).Decide(ctx, in.Model, state,
			map[string]ai.JevQuestion{"asked": {Type: "noul", Instructions: "In `conversation`, did the student ask about the invasion of Russia?"}})
		if err != nil {
			writeErr(w, 502, "provider_error", err.Error())
			return
		}
		writeJSON(w, 200, providerTestResponse{OK: true, LatencyMs: time.Since(start).Milliseconds(), Output: mustJSON(res.Answers)})
		return
	}
	tm, ok := cp.p.(ai.TextModel)
	if !ok {
		writeErr(w, 400, "provider_error", "provider cannot generate text")
		return
	}
	res, err := s.Gateway.meterText(tm, entry).Generate(ctx, ai.Request{Model: in.Model, Messages: []ai.Message{{Role: "user", Content: "Reply with the single word: ok"}}, MaxTokens: 50})
	if err != nil {
		writeErr(w, 502, "provider_error", err.Error())
		return
	}
	writeJSON(w, 200, providerTestResponse{OK: true, LatencyMs: time.Since(start).Milliseconds(), Output: res.Text, Usage: &res.Usage})
}

func usageOr(r *ai.JevResult) ai.Usage {
	if r == nil {
		return ai.Usage{}
	}
	return r.Usage
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
		MonthSpendUSD: s.Gateway.monthSpend(),
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
