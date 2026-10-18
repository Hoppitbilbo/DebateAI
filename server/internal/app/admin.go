package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

// ---------- overview ----------

func (s *Server) handleAdminOverview(w http.ResponseWriter, r *http.Request) {
	b := s.budget()
	spend := s.monthSpend()
	today := time.Now().UTC().Truncate(24 * time.Hour).Format(time.RFC3339)
	var todayCost sql.NullFloat64
	_ = s.db.QueryRow(`SELECT SUM(cost_usd) FROM usage_log WHERE created_at >= ?`, today).Scan(&todayCost)
	writeJSON(w, 200, map[string]any{
		"users": map[string]int{
			"admin":   countRows(s.db, `SELECT COUNT(*) FROM users WHERE role='admin'`),
			"teacher": countRows(s.db, `SELECT COUNT(*) FROM users WHERE role='teacher'`),
			"student": countRows(s.db, `SELECT COUNT(*) FROM users WHERE role='student'`),
		},
		"classes":         countRows(s.db, `SELECT COUNT(*) FROM classes WHERE archived = 0`),
		"assignments":     countRows(s.db, `SELECT COUNT(*) FROM assignments`),
		"sessions":        countRows(s.db, `SELECT COUNT(*) FROM activity_sessions WHERE turns > 0`),
		"pendingInvites":  countRows(s.db, `SELECT COUNT(*) FROM invites WHERE kind='invite' AND accepted_at IS NULL AND expires_at > ?`, now()),
		"providers":       countRows(s.db, `SELECT COUNT(*) FROM providers WHERE enabled = 1`),
		"monthSpendUsd":   spend,
		"todaySpendUsd":   todayCost.Float64,
		"monthBudgetUsd":  b.MonthlyUSD,
		"budgetExceeded":  s.budgetExceeded(),
		"requestsToday":   countRows(s.db, `SELECT COUNT(*) FROM usage_log WHERE created_at >= ?`, today),
		"errorsToday":     countRows(s.db, `SELECT COUNT(*) FROM usage_log WHERE created_at >= ? AND ok = 0`, today),
		"mailConfigured":  s.smtp().Host != "",
		"routingComplete": len(s.routing().Tasks[TaskChat]) > 0,
	})
}

// ---------- users ----------

func (s *Server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	q := "%" + strings.TrimSpace(r.URL.Query().Get("q")) + "%"
	role := r.URL.Query().Get("role")
	query := `SELECT ` + userCols + ` FROM users WHERE (name LIKE ? OR email LIKE ?)`
	args := []any{q, q}
	if validRole(role) {
		query += ` AND role = ?`
		args = append(args, role)
	}
	rows, err := s.db.Query(query+` ORDER BY created_at DESC LIMIT 500`, args...)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	defer rows.Close()
	type userOut struct {
		*User
		Classes int     `json:"classes"`
		CostUSD float64 `json:"costUsd"`
	}
	out := []userOut{}
	for rows.Next() {
		if u, err := scanUser(rows); err == nil {
			out = append(out, userOut{User: u})
		}
	}
	rows.Close()
	for i := range out {
		out[i].Classes = countRows(s.db, `SELECT COUNT(*) FROM class_members WHERE user_id = ?`, out[i].ID)
		var c sql.NullFloat64
		_ = s.db.QueryRow(`SELECT SUM(cost_usd) FROM usage_log WHERE user_id = ? AND created_at >= ?`, out[i].ID, monthStart()).Scan(&c)
		out[i].CostUSD = c.Float64
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
	id, err := s.createUser(in.Email, in.Name, in.Password, in.Role, in.Locale)
	if err != nil {
		writeErr(w, 400, "invalid", err.Error())
		return
	}
	if in.ClassID != nil {
		role := "student"
		if in.Role != "student" {
			role = "teacher"
		}
		_, _ = s.db.Exec(`INSERT OR IGNORE INTO class_members(class_id, user_id, role, joined_at) VALUES(?,?,?,?)`, *in.ClassID, id, role, now())
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
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		_, _ = s.db.Exec(`UPDATE users SET name = ? WHERE id = ?`, strings.TrimSpace(*in.Name), id)
	}
	if in.Role != nil && validRole(*in.Role) {
		_, _ = s.db.Exec(`UPDATE users SET role = ? WHERE id = ?`, *in.Role, id)
	}
	if in.Active != nil {
		_, _ = s.db.Exec(`UPDATE users SET active = ? WHERE id = ?`, boolInt(*in.Active), id)
		if !*in.Active {
			_, _ = s.db.Exec(`DELETE FROM auth_sessions WHERE user_id = ?`, id)
		}
	}
	if in.Locale != nil {
		_, _ = s.db.Exec(`UPDATE users SET locale = ? WHERE id = ?`, normLocale(*in.Locale), id)
	}
	if in.Password != nil && *in.Password != "" {
		if err := s.setPassword(id, *in.Password); err != nil {
			writeErr(w, 400, "invalid", err.Error())
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
	_, _ = s.db.Exec(`DELETE FROM users WHERE id = ?`, pathID(r, "id"))
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// ---------- invites ----------

func (s *Server) listInvites(where string, args ...any) []inviteRow {
	rows, err := s.db.Query(`SELECT i.id, i.kind, i.email, i.role, i.class_id, COALESCE(c.name,''), COALESCE(u.name,''), i.locale, i.created_at, i.expires_at, i.accepted_at, i.email_sent
		FROM invites i LEFT JOIN classes c ON c.id = i.class_id LEFT JOIN users u ON u.id = i.invited_by `+where, args...)
	out := []inviteRow{}
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var inv inviteRow
		var cid sql.NullInt64
		var acc sql.NullString
		var sent int
		if rows.Scan(&inv.ID, &inv.Kind, &inv.Email, &inv.Role, &cid, &inv.ClassName, &inv.InvitedBy, &inv.Locale, &inv.CreatedAt, &inv.ExpiresAt, &acc, &sent) != nil {
			continue
		}
		if cid.Valid {
			inv.ClassID = &cid.Int64
		}
		if acc.Valid {
			inv.AcceptedAt = &acc.String
		}
		inv.EmailSent = sent == 1
		out = append(out, inv)
	}
	return out
}

func (s *Server) handleListInvites(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, s.listInvites(`WHERE i.kind = 'invite' ORDER BY i.created_at DESC LIMIT 500`))
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
		_ = s.db.QueryRow(`SELECT name FROM classes WHERE id = ?`, *in.ClassID).Scan(&className)
	}
	locale := in.Locale
	if locale == "" {
		locale = u.Locale
	}
	results := []any{}
	for _, e := range splitEmails(in.Emails) {
		if _, err := s.getUserByEmail(e); err == nil && in.ClassID == nil {
			results = append(results, map[string]string{"email": e, "status": "error", "error": "already registered"})
			continue
		}
		inv, err := s.createInvite(r, u, e, in.Role, in.ClassID, className, locale)
		if err != nil {
			results = append(results, map[string]string{"email": e, "status": "error", "error": err.Error()})
			continue
		}
		results = append(results, map[string]any{"email": inv.Email, "status": "invited", "emailSent": inv.EmailSent, "link": inv.Link})
	}
	writeJSON(w, 200, map[string]any{"results": results})
}

func (s *Server) handleResendInvite(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := pathID(r, "id")
	var email, role, locale string
	var classID sql.NullInt64
	if err := s.db.QueryRow(`SELECT email, role, class_id, locale FROM invites WHERE id = ? AND kind = 'invite'`, id).Scan(&email, &role, &classID, &locale); err != nil {
		writeErr(w, 404, "not_found", "invite not found")
		return
	}
	_, _ = s.db.Exec(`DELETE FROM invites WHERE id = ?`, id)
	var cid *int64
	className := ""
	if classID.Valid {
		cid = &classID.Int64
		_ = s.db.QueryRow(`SELECT name FROM classes WHERE id = ?`, *cid).Scan(&className)
	}
	inv, err := s.createInvite(r, u, email, role, cid, className, locale)
	if err != nil {
		writeErr(w, 400, "invalid", err.Error())
		return
	}
	writeJSON(w, 200, inv)
}

func (s *Server) handleDeleteInvite(w http.ResponseWriter, r *http.Request) {
	_, _ = s.db.Exec(`DELETE FROM invites WHERE id = ?`, pathID(r, "id"))
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// ---------- settings ----------

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	smtp := s.smtp()
	hasPw := smtp.Password != ""
	smtp.Password = ""
	writeJSON(w, 200, map[string]any{
		"general":         s.general(),
		"smtp":            smtp,
		"smtpHasPassword": hasPw,
		"budget":          s.budget(),
		"routing":         s.routing(),
		"jev":             s.jevSettings(),
		"tasks":           AllTasks,
	})
}

func (s *Server) handlePutSetting(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	var err error
	switch key {
	case "general":
		v := defaultGeneral()
		if err = readJSON(r, &v); err == nil {
			v.DefaultLocale = normLocale(v.DefaultLocale)
			err = putSetting(s.db, key, v)
		}
	case "smtp":
		var v SMTPSettings
		if err = readJSON(r, &v); err == nil {
			if v.Password == "" { // keep the stored password unless a new one is sent
				old := getSetting(s.db, "smtp", SMTPSettings{})
				v.Password = old.Password
			} else {
				v.Password = s.crypto.Encrypt(v.Password)
			}
			if v.Port == 0 {
				v.Port = 587
			}
			err = putSetting(s.db, key, v)
		}
	case "budget":
		var v BudgetSettings
		if err = readJSON(r, &v); err == nil {
			err = putSetting(s.db, key, v)
		}
	case "routing":
		var v RoutingSettings
		if err = readJSON(r, &v); err == nil {
			if v.Tasks == nil {
				v.Tasks = map[string][]RouteTarget{}
			}
			err = putSetting(s.db, key, v)
		}
	case "jev":
		v := defaultJev()
		if err = readJSON(r, &v); err == nil {
			err = putSetting(s.db, key, v)
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
	subj, body := renderMail("test", u.Locale, map[string]string{"site": s.general().SiteName})
	if err := s.sendMail(in.To, subj, body); err != nil {
		writeErr(w, 502, "smtp_error", err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// ---------- providers ----------

func (s *Server) loadProviders() []providerRow {
	rows, err := s.db.Query(`SELECT id, name, kind, base_url, api_key_enc, models_json, enabled, created_at FROM providers ORDER BY id`)
	out := []providerRow{}
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var p providerRow
		var keyEnc, models string
		var enabled int
		if rows.Scan(&p.ID, &p.Name, &p.Kind, &p.BaseURL, &keyEnc, &models, &enabled, &p.CreatedAt) != nil {
			continue
		}
		p.Enabled = enabled == 1
		if key, err := s.crypto.Decrypt(keyEnc); err == nil && key != "" {
			p.HasKey = true
			if len(key) > 8 {
				p.KeyHint = key[:3] + "…" + key[len(key)-4:]
			}
		}
		_ = json.Unmarshal([]byte(models), &p.Models)
		if p.Models == nil {
			p.Models = []ai.ModelInfo{}
		}
		out = append(out, p)
	}
	return out
}

func (s *Server) handleListProviders(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, s.loadProviders())
}

func validKind(k string) bool {
	return k == ai.KindGemini || k == ai.KindOpenAI || k == ai.KindAnthropic || k == ai.KindJev
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
	if strings.TrimSpace(in.Name) == "" || !validKind(in.Kind) {
		writeErr(w, 400, "bad_request", "name and a valid kind are required")
		return
	}
	id, err := s.insertProvider(strings.TrimSpace(in.Name), in.Kind, in.BaseURL, in.APIKey)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	// Fetch the full model list right away (OpenRouter, OpenCode, Gemini,
	// Ollama…); the preset list is only a fallback when listing fails.
	fetched := false
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	if cp, err := s.provider(id); err == nil {
		if models, err := cp.p.ListModels(ctx); err == nil && len(models) > 0 {
			s.storeModels(id, models)
			fetched = true
		}
	}
	cancel()
	if !fetched && len(in.Models) > 0 {
		s.storeModels(id, in.Models)
	}
	s.autoRoute(id, in.Kind)
	for _, p := range s.loadProviders() {
		if p.ID == id {
			writeJSON(w, 201, p)
			return
		}
	}
}

// autoRoute fills empty routing tasks with a sensible model of a newly added
// provider, so a fresh install works right after the first provider is added.
func (s *Server) autoRoute(providerID int64, kind string) {
	var models []ai.ModelInfo
	var raw string
	_ = s.db.QueryRow(`SELECT models_json FROM providers WHERE id = ?`, providerID).Scan(&raw)
	_ = json.Unmarshal([]byte(raw), &models)
	pick := func(prefer ...string) string {
		for _, p := range prefer {
			for _, m := range models {
				if m.ID == p {
					return p
				}
			}
		}
		for _, p := range prefer { // known-good default even if listing failed
			if p != "" {
				return p
			}
		}
		if len(models) > 0 {
			return models[0].ID
		}
		return ""
	}
	rt := s.routing()
	add := func(task, model string) {
		if model != "" && len(rt.Tasks[task]) == 0 {
			rt.Tasks[task] = []RouteTarget{{providerID, model}}
		}
	}
	// newestFlash returns the most recent listed Gemini "flash" model, so new
	// installs follow Google's lineup instead of a hard-coded name.
	newestFlash := func(live, lite bool, fallback string) string {
		best := ""
		for _, m := range models {
			id := strings.TrimPrefix(m.ID, "models/")
			if m.SupportLive != live || !strings.Contains(id, "flash") || strings.Contains(id, "lite") != lite ||
				strings.Contains(id, "image") || strings.Contains(id, "tts") || strings.Contains(id, "audio") || strings.Contains(id, "thinking") {
				continue
			}
			if best == "" || geminiVersion(id) > geminiVersion(best) || (geminiVersion(id) == geminiVersion(best) && id > best) {
				best = id
			}
		}
		if best != "" {
			return best
		}
		return pick(fallback)
	}
	switch kind {
	case ai.KindJev:
		// Jev is purpose-built for judging: put it first, keep others as fallback.
		if m := pick("jev-latest", "jev-1.13-free", "jev-1.13"); m != "" {
			rest := rt.Tasks[TaskJudge][:0:0]
			for _, t := range rt.Tasks[TaskJudge] {
				if t.ProviderID != providerID {
					rest = append(rest, t)
				}
			}
			rt.Tasks[TaskJudge] = append([]RouteTarget{{providerID, m}}, rest...)
		}
	case ai.KindGemini:
		flash := newestFlash(false, false, "gemini-2.5-flash")
		add(TaskChat, flash)
		add(TaskEvaluation, flash)
		add(TaskUtility, newestFlash(false, true, flash))
		add(TaskJudge, newestFlash(false, true, flash))
		add(TaskLive, newestFlash(true, false, "gemini-3.1-flash-live-preview"))
	default:
		var first string
		for _, m := range models {
			if m.Free {
				first = m.ID
				break
			}
		}
		if first == "" {
			first = pick()
		}
		add(TaskChat, first)
		add(TaskEvaluation, first)
		add(TaskUtility, first)
		add(TaskJudge, first)
	}
	_ = putSetting(s.db, "routing", rt)
}

// geminiVersion extracts the version number from ids such as
// "gemini-3.1-flash-live-preview" or "gemini-live-2.5-flash" (0 if none).
func geminiVersion(id string) float64 {
	for _, part := range strings.Split(id, "-") {
		if v, err := strconv.ParseFloat(part, 64); err == nil {
			return v
		}
	}
	return 0
}

func (s *Server) storeModels(providerID int64, models []ai.ModelInfo) {
	_, _ = s.db.Exec(`UPDATE providers SET models_json = ? WHERE id = ?`, mustJSON(models), providerID)
	// Import prices published by the upstream (e.g. OpenRouter) when the admin
	// has not set them manually.
	for _, m := range models {
		if m.InputPerM != nil && m.OutputPerM != nil {
			_, _ = s.db.Exec(`INSERT OR IGNORE INTO model_prices(provider_id, model, input_per_m, output_per_m) VALUES(?,?,?,?)`, providerID, m.ID, *m.InputPerM, *m.OutputPerM)
		} else if m.Free {
			_, _ = s.db.Exec(`INSERT OR IGNORE INTO model_prices(provider_id, model, input_per_m, output_per_m) VALUES(?,?,0,0)`, providerID, m.ID)
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
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		_, _ = s.db.Exec(`UPDATE providers SET name = ? WHERE id = ?`, strings.TrimSpace(*in.Name), id)
	}
	if in.BaseURL != nil {
		_, _ = s.db.Exec(`UPDATE providers SET base_url = ? WHERE id = ?`, strings.TrimSpace(*in.BaseURL), id)
	}
	if in.APIKey != nil && *in.APIKey != "" {
		_, _ = s.db.Exec(`UPDATE providers SET api_key_enc = ? WHERE id = ?`, s.crypto.Encrypt(strings.TrimSpace(*in.APIKey)), id)
	}
	if in.Enabled != nil {
		_, _ = s.db.Exec(`UPDATE providers SET enabled = ? WHERE id = ?`, boolInt(*in.Enabled), id)
	}
	s.invalidateProvider(id)
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
	_, _ = s.db.Exec(`DELETE FROM providers WHERE id = ?`, id)
	s.invalidateProvider(id)
	rt := s.routing()
	for task, list := range rt.Tasks {
		kept := list[:0:0]
		for _, t := range list {
			if t.ProviderID != id {
				kept = append(kept, t)
			}
		}
		rt.Tasks[task] = kept
	}
	_ = putSetting(s.db, "routing", rt)
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *Server) handleRefreshModels(w http.ResponseWriter, r *http.Request) {
	id := pathID(r, "id")
	s.invalidateProvider(id)
	cp, err := s.provider(id)
	if err != nil {
		writeErr(w, 400, "provider_error", err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	models, err := cp.p.ListModels(ctx)
	if err != nil {
		writeErr(w, 502, "provider_error", err.Error())
		return
	}
	s.storeModels(id, models)
	writeJSON(w, 200, models)
}

func (s *Server) handleTestProvider(w http.ResponseWriter, r *http.Request) {
	id := pathID(r, "id")
	var in struct{ Model string }
	if err := readJSON(r, &in); err != nil || in.Model == "" {
		writeErr(w, 400, "bad_request", "model required")
		return
	}
	s.invalidateProvider(id)
	cp, err := s.provider(id)
	if err != nil {
		writeErr(w, 400, "provider_error", err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()
	start := time.Now()
	u := currentUser(r)
	if d, ok := cp.p.(ai.Decider); ok {
		res, err := d.Decide(ctx, in.Model, "STUDENT: I asked Napoleon why he invaded Russia and he explained the Continental System.",
			map[string]ai.JevQuestion{"asked": {Type: "noul", Instructions: "Did the student ask about the invasion of Russia?"}})
		s.logUsage(usageEntry{UserID: &u.ID, ProviderID: id, Provider: cp.name, Model: in.Model, Task: "test", OK: err == nil, Latency: time.Since(start), Usage: usageOr(res)})
		if err != nil {
			writeErr(w, 502, "provider_error", err.Error())
			return
		}
		writeJSON(w, 200, map[string]any{"ok": true, "latencyMs": time.Since(start).Milliseconds(), "output": mustJSON(res.Answers)})
		return
	}
	res, err := cp.p.Generate(ctx, ai.Request{Model: in.Model, Messages: []ai.Message{{Role: "user", Content: "Reply with the single word: ok"}}, MaxTokens: 50})
	entry := usageEntry{UserID: &u.ID, ProviderID: id, Provider: cp.name, Model: in.Model, Task: "test", OK: err == nil, Latency: time.Since(start)}
	if err != nil {
		entry.Err = err.Error()
		s.logUsage(entry)
		writeErr(w, 502, "provider_error", err.Error())
		return
	}
	entry.Usage = res.Usage
	s.logUsage(entry)
	writeJSON(w, 200, map[string]any{"ok": true, "latencyMs": time.Since(start).Milliseconds(), "output": res.Text, "usage": res.Usage})
}

func usageOr(r *ai.JevResult) ai.Usage {
	if r == nil {
		return ai.Usage{}
	}
	return r.Usage
}

// ---------- prices ----------

func (s *Server) handleListPrices(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(`SELECT p.provider_id, COALESCE(pr.name,''), p.model, p.input_per_m, p.output_per_m FROM model_prices p LEFT JOIN providers pr ON pr.id = p.provider_id ORDER BY pr.name, p.model`)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	defer rows.Close()
	type row struct {
		ProviderID   int64   `json:"providerId"`
		ProviderName string  `json:"providerName"`
		Model        string  `json:"model"`
		InputPerM    float64 `json:"inputPerM"`
		OutputPerM   float64 `json:"outputPerM"`
	}
	out := []row{}
	for rows.Next() {
		var x row
		if rows.Scan(&x.ProviderID, &x.ProviderName, &x.Model, &x.InputPerM, &x.OutputPerM) == nil {
			out = append(out, x)
		}
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
	if in.Delete {
		_, _ = s.db.Exec(`DELETE FROM model_prices WHERE provider_id = ? AND model = ?`, in.ProviderID, in.Model)
	} else {
		_, _ = s.db.Exec(`INSERT INTO model_prices(provider_id, model, input_per_m, output_per_m) VALUES(?,?,?,?)
			ON CONFLICT(provider_id, model) DO UPDATE SET input_per_m = excluded.input_per_m, output_per_m = excluded.output_per_m`,
			in.ProviderID, in.Model, in.InputPerM, in.OutputPerM)
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

	type agg struct {
		Key          string  `json:"key"`
		Label        string  `json:"label,omitempty"`
		Requests     int     `json:"requests"`
		Errors       int     `json:"errors"`
		InputTokens  int64   `json:"inputTokens"`
		OutputTokens int64   `json:"outputTokens"`
		CostUSD      float64 `json:"costUsd"`
	}
	group := func(expr, label string, byKey bool) []agg {
		order := `SUM(cost_usd) DESC, COUNT(*) DESC`
		if byKey {
			order = `1`
		}
		rows, err := s.db.Query(`SELECT `+expr+`, `+label+`, COUNT(*), SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END), SUM(input_tokens), SUM(output_tokens), SUM(cost_usd)
			FROM usage_log l WHERE created_at >= ? GROUP BY 1 ORDER BY `+order+` LIMIT 400`, since)
		out := []agg{}
		if err != nil {
			return out
		}
		defer rows.Close()
		for rows.Next() {
			var a agg
			var key, lbl sql.NullString
			if rows.Scan(&key, &lbl, &a.Requests, &a.Errors, &a.InputTokens, &a.OutputTokens, &a.CostUSD) == nil {
				a.Key, a.Label = key.String, lbl.String
				out = append(out, a)
			}
		}
		return out
	}
	writeJSON(w, 200, map[string]any{
		"days":       days,
		"byDay":      group(`substr(created_at, 1, 10)`, `''`, true),
		"byModel":    group(`provider_name || ' / ' || model`, `MAX(model)`, false),
		"byTask":     group(`task`, `''`, false),
		"byProvider": group(`provider_name`, `''`, false),
		"byUser":     group(`CAST(COALESCE(user_id, 0) AS TEXT)`, `(SELECT COALESCE(name, 'guest') FROM users WHERE id = l.user_id)`, false),
		"byClass": group(`CAST(COALESCE((SELECT a.class_id FROM activity_sessions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = l.session_id), 0) AS TEXT)`,
			`(SELECT c.name FROM activity_sessions s JOIN assignments a ON a.id = s.assignment_id JOIN classes c ON c.id = a.class_id WHERE s.id = l.session_id)`, false),
		"monthSpendUsd": s.monthSpend(),
		"budget":        s.budget(),
	})
}

func (s *Server) handleUsageLog(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	rows, err := s.db.Query(`SELECT l.id, l.created_at, COALESCE(u.name,''), l.session_id, l.provider_name, l.model, l.task, l.input_tokens, l.output_tokens, l.cost_usd, l.ok, l.latency_ms, l.error
		FROM usage_log l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT ?`, limit)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	defer rows.Close()
	type row struct {
		ID           int64   `json:"id"`
		CreatedAt    string  `json:"createdAt"`
		User         string  `json:"user"`
		SessionID    *int64  `json:"sessionId,omitempty"`
		Provider     string  `json:"provider"`
		Model        string  `json:"model"`
		Task         string  `json:"task"`
		InputTokens  int     `json:"inputTokens"`
		OutputTokens int     `json:"outputTokens"`
		CostUSD      float64 `json:"costUsd"`
		OK           bool    `json:"ok"`
		LatencyMs    int     `json:"latencyMs"`
		Error        string  `json:"error,omitempty"`
	}
	out := []row{}
	for rows.Next() {
		var x row
		var sid sql.NullInt64
		var ok int
		if rows.Scan(&x.ID, &x.CreatedAt, &x.User, &sid, &x.Provider, &x.Model, &x.Task, &x.InputTokens, &x.OutputTokens, &x.CostUSD, &ok, &x.LatencyMs, &x.Error) == nil {
			if sid.Valid {
				x.SessionID = &sid.Int64
			}
			x.OK = ok == 1
			out = append(out, x)
		}
	}
	writeJSON(w, 200, out)
}
