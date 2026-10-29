package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// ---------- access control for AI endpoints ----------

func (s *Server) aiAllowed(w http.ResponseWriter, r *http.Request) (*domain.User, bool) {
	u := s.userFromRequest(r)
	g := s.Settings.General()
	if u == nil {
		if !g.GuestAccess {
			writeErr(w, 401, "login_required", "login required to use the AI apps")
			return nil, false
		}
		if !s.limiter.allow("guest:"+s.clientIP(r), g.GuestRequestsPerHour, time.Hour) {
			writeErr(w, 429, "rate_limited", "too many requests from this network, retry later or log in")
			return nil, false
		}
		return nil, true
	}
	if u.IsGuest() {
		if err := s.RoomSvc.AllowAI(u); errors.Is(err, app.ErrUsageUnavailable) {
			writeErr(w, 503, "usage_unavailable", err.Error())
			return nil, false
		} else if err != nil {
			writeErr(w, 429, "rate_limited", err.Error())
			return nil, false
		}
	}
	if u.Role == "student" && g.StudentRequestsPerDay > 0 {
		since := time.Now().UTC().Add(-24 * time.Hour).Format(time.RFC3339)
		n, err := s.Usage.CountUserRequestsSince(u.ID, since, app.TaskJudge)
		if err != nil {
			writeErr(w, 503, "usage_unavailable", app.ErrUsageUnavailable.Error())
			return nil, false
		}
		if n >= g.StudentRequestsPerDay {
			writeErr(w, 429, "daily_limit", "daily AI request limit reached")
			return nil, false
		}
	}
	return u, true
}

// sessionFor validates that sessionID belongs to user; returns nil if absent.
func (s *Server) sessionFor(u *domain.User, sessionID int64) (*int64, string, error) {
	if sessionID == 0 || u == nil {
		return nil, "", nil
	}
	owner, status, err := s.Sessions.Owner(sessionID)
	if err != nil {
		return nil, "", errors.New("session not found")
	}
	if owner == nil || *owner != u.ID {
		return nil, "", errors.New("session does not belong to you")
	}
	return &sessionID, status, nil
}

// ---------- handlers ----------

// aiContext is the context of the AI calls of a request: room guests use
// the models chosen for rooms.
func aiContext(r *http.Request, u *domain.User) context.Context {
	if u != nil && u.IsGuest() {
		return app.WithRoomRouting(r.Context())
	}
	return r.Context()
}

func (s *Server) handleAIStatus(w http.ResponseWriter, r *http.Request) {
	u := s.userFromRequest(r)
	g := s.Settings.General()
	ctx := aiContext(r, u)
	live := g.LiveEnabled && len(s.Gateway.TargetsFor(ctx, app.TaskLive)) > 0 && (u != nil || g.GuestLive)
	writeJSON(w, 200, aiStatusResponse{
		Text:        len(s.Gateway.TargetsFor(ctx, app.TaskChat)) > 0 && (u != nil || g.GuestAccess),
		Live:        live,
		Judge:       s.Settings.Jev().Enabled && len(s.Gateway.TargetsFor(ctx, app.TaskJudge)) > 0,
		LoggedIn:    u != nil,
		GuestAccess: g.GuestAccess,
	})
}

type generateIn struct {
	Task        string       `json:"task"`
	System      string       `json:"system"`
	Messages    []ai.Message `json:"messages"`
	SessionID   int64        `json:"sessionId"`
	Stream      bool         `json:"stream"`
	JSON        bool         `json:"json"`
	Temperature *float64     `json:"temperature"`
	MaxTokens   int          `json:"maxTokens"`
}

func (s *Server) handleGenerate(w http.ResponseWriter, r *http.Request) {
	u, ok := s.aiAllowed(w, r)
	if !ok {
		return
	}
	var in generateIn
	if err := readJSONLimit(r, &in, maxGenerateBodyBytes); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	switch in.Task {
	case "", app.TaskChat:
		in.Task = app.TaskChat
	case app.TaskEvaluation, app.TaskUtility:
	default:
		writeErr(w, 400, "bad_task", "unknown task")
		return
	}
	if len(in.Messages) == 0 {
		writeErr(w, 400, "bad_request", "messages required")
		return
	}
	if in.Messages = boundHistory(in.System, in.Messages); in.Messages == nil {
		writeErr(w, 413, "too_large", "the request is too long for the model")
		return
	}
	in.MaxTokens = min(max(in.MaxTokens, 0), maxGenerateOutputTokens)
	var userID *int64
	if u != nil {
		userID = &u.ID
	}
	sessionID, status, err := s.sessionFor(u, in.SessionID)
	if err != nil {
		writeErr(w, 403, "bad_session", err.Error())
		return
	}
	if sessionID != nil && in.Task == app.TaskChat && status != domain.SessionActive {
		writeErr(w, 409, "session_ended", "this activity has ended")
		return
	}
	release, err := s.Gateway.Admit(s.generationScopes(r, u))
	if errors.Is(err, app.ErrTooManyGenerations) {
		writeErr(w, 429, "busy", err.Error())
		return
	} else if err != nil {
		writeErr(w, 503, "usage_unavailable", err.Error())
		return
	}
	defer release()
	req := ai.Request{System: in.System, Messages: in.Messages, JSON: in.JSON, Temperature: in.Temperature, MaxTokens: in.MaxTokens}

	if !in.Stream {
		res, err := s.Gateway.Generate(aiContext(r, u), in.Task, req, userID, sessionID, nil)
		if err != nil {
			writeErr(w, 502, "ai_error", err.Error())
			return
		}
		writeJSON(w, 200, generateResponse{Text: res.Text, Provider: res.Provider, Model: res.Model})
		return
	}

	flusher, _ := w.(http.Flusher)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(200)
	send := func(v any) error {
		b, _ := json.Marshal(v)
		if _, err := fmt.Fprintf(w, "data: %s\n\n", b); err != nil {
			return err
		}
		if flusher != nil {
			flusher.Flush()
		}
		return nil
	}
	res, err := s.Gateway.Generate(aiContext(r, u), in.Task, req, userID, sessionID, func(d string) error { return send(streamDelta{Delta: d}) })
	if err != nil {
		_ = send(streamError{Error: err.Error()})
		return
	}
	_ = send(streamDone{Done: true, Provider: res.Provider, Model: res.Model})
}

// boundHistory keeps the newest messages within maxChatHistoryMessages and
// maxChatInputChars. It returns nil when even the last message does not fit.
func boundHistory(system string, msgs []ai.Message) []ai.Message {
	if len(msgs) > maxChatHistoryMessages {
		msgs = msgs[len(msgs)-maxChatHistoryMessages:]
	}
	total := len(system)
	for i := len(msgs) - 1; i >= 0; i-- {
		total += len(msgs[i].Content)
		if total > maxChatInputChars {
			if i == len(msgs)-1 {
				return nil
			}
			return msgs[i+1:]
		}
	}
	return msgs
}

// generationScopes are the concurrency limits of an AI request of u (nil
// without an account).
func (s *Server) generationScopes(r *http.Request, u *domain.User) []app.Admission {
	if u == nil {
		return []app.Admission{{Scope: "ip:" + s.clientIP(r), Limit: maxGenerationsPerNetwork}}
	}
	scopes := []app.Admission{{Scope: fmt.Sprintf("user:%d", u.ID), Limit: maxGenerationsPerUser}}
	if u.IsGuest() && u.RoomID != nil {
		scopes = append(scopes, app.Admission{Scope: fmt.Sprintf("room:%d", *u.RoomID), Limit: maxGenerationsPerRoom})
	}
	return scopes
}

func (s *Server) handleLiveToken(w http.ResponseWriter, r *http.Request) {
	u := s.userFromRequest(r)
	g := s.Settings.General()
	if !g.LiveEnabled || (u == nil && !g.GuestLive) || (u != nil && u.IsGuest()) {
		writeErr(w, 403, "live_disabled", "live conversation is not enabled for this account")
		return
	}
	if _, ok := s.aiAllowed(w, r); !ok {
		return
	}
	if !s.limiter.allow(fmt.Sprintf("live:%s:%v", s.clientIP(r), u != nil), liveTokensLimit, time.Hour) {
		writeErr(w, 429, "rate_limited", "too many live sessions, retry later")
		return
	}
	var in struct {
		SessionID         int64  `json:"sessionId"`
		SystemInstruction string `json:"systemInstruction"`
		VoiceName         string `json:"voiceName"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	sessionID, status, err := s.sessionFor(u, in.SessionID)
	if err != nil {
		writeErr(w, 403, "bad_session", err.Error())
		return
	} else if status != "" && status != domain.SessionActive {
		writeErr(w, 409, "session_ended", "this activity has ended")
		return
	}
	var userID *int64
	if u != nil {
		userID = &u.ID
	}
	tok, err := s.Gateway.LiveToken(r.Context(), in.SystemInstruction, in.VoiceName, userID, sessionID)
	if err != nil {
		writeErr(w, 502, "live_unavailable", err.Error())
		return
	}
	writeJSON(w, 200, tok)
}

// handleLiveUsage records token usage reported by the browser at the end of a
// Live session (the WebSocket goes directly to Google, so the server only
// learns usage from the client). Only once per grant from /live/token.
func (s *Server) handleLiveUsage(w http.ResponseWriter, r *http.Request) {
	u := s.userFromRequest(r)
	var in struct {
		GrantID      string `json:"grantId"`
		InputTokens  int    `json:"inputTokens"`
		OutputTokens int    `json:"outputTokens"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	// sanity bounds: ignore absurd client values
	if in.InputTokens < 0 || in.OutputTokens < 0 || in.InputTokens > 5_000_000 || in.OutputTokens > 5_000_000 {
		writeErr(w, 400, "bad_request", "invalid usage")
		return
	}
	var userID *int64
	if u != nil {
		userID = &u.ID
	}
	cost, err := s.Gateway.RecordLiveUsage(app.LiveUsage{GrantID: in.GrantID, UserID: userID, InputTokens: in.InputTokens, OutputTokens: in.OutputTokens})
	if err != nil {
		writeErr(w, 409, "bad_grant", err.Error())
		return
	}
	writeJSON(w, 200, liveUsageResponse{OK: true, CostUSD: cost})
}
