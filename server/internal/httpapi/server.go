package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Server is the HTTP side: routes, middleware and handlers over Services.
type Server struct {
	cfg app.Config
	*app.Services
	static  fs.FS
	limiter *rateLimiter
	proxies proxyTrust
}

func NewServer(cfg app.Config, services *app.Services, static fs.FS) *Server {
	s := &Server{cfg: cfg, Services: services, static: static, limiter: newRateLimiter(), proxies: parseProxyTrust(cfg.TrustedProxies)}
	go func() {
		for range time.Tick(roomPurgeEvery) {
			s.RoomSvc.Purge()
		}
	}()
	go s.Outbox.Run(context.Background())
	return s
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// public
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) { writeOK(w) })
	mux.HandleFunc("GET /api/public/config", s.handlePublicConfig)
	mux.HandleFunc("POST /api/setup", s.handleSetup)

	// auth
	mux.HandleFunc("POST /api/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("GET /api/auth/me", s.handleMe)
	mux.HandleFunc("PATCH /api/auth/me", s.auth(s.handleUpdateMe))
	mux.HandleFunc("GET /api/auth/invite/{token}", s.handleInviteInfo)
	mux.HandleFunc("POST /api/auth/register", s.handleRegister)
	mux.HandleFunc("POST /api/auth/forgot", s.handleForgot)
	mux.HandleFunc("POST /api/auth/reset", s.handleReset)

	// AI gateway
	mux.HandleFunc("GET /api/ai/status", s.handleAIStatus)
	mux.HandleFunc("POST /api/ai/generate", s.handleGenerate)
	mux.HandleFunc("POST /api/ai/live/token", s.handleLiveToken)
	mux.HandleFunc("POST /api/ai/live/usage", s.handleLiveUsage)

	// student
	mux.HandleFunc("GET /api/me/classes", s.auth(s.handleMyClasses))
	mux.HandleFunc("GET /api/me/assignments", s.auth(s.handleMyAssignments))
	mux.HandleFunc("GET /api/me/sessions", s.auth(s.handleMySessions))
	mux.HandleFunc("POST /api/classes/join", s.auth(s.handleJoinClass))

	// activity sessions
	mux.HandleFunc("POST /api/sessions", s.auth(s.handleCreateSession))
	mux.HandleFunc("GET /api/sessions/{id}", s.auth(s.handleGetSession))
	mux.HandleFunc("PUT /api/sessions/{id}/transcript", s.auth(s.handleSaveTranscript))
	mux.HandleFunc("POST /api/sessions/{id}/complete", s.auth(s.handleCompleteSession))
	mux.HandleFunc("POST /api/sessions/{id}/evaluate", s.auth(s.handleEvaluateSession))
	mux.HandleFunc("PUT /api/sessions/{id}/feedback", s.role("teacher", s.handleSessionFeedback))

	// assignments (read for members)
	mux.HandleFunc("GET /api/assignments/{id}", s.auth(s.handleGetAssignment))

	// teacher
	mux.HandleFunc("GET /api/classes", s.role("teacher", s.handleListClasses))
	mux.HandleFunc("POST /api/classes", s.role("teacher", s.handleCreateClass))
	mux.HandleFunc("GET /api/classes/{id}", s.role("teacher", s.handleGetClass))
	mux.HandleFunc("PATCH /api/classes/{id}", s.role("teacher", s.handleUpdateClass))
	mux.HandleFunc("DELETE /api/classes/{id}", s.role("teacher", s.handleDeleteClass))
	mux.HandleFunc("POST /api/classes/{id}/code", s.role("teacher", s.handleRegenerateCode))
	mux.HandleFunc("POST /api/classes/{id}/invite", s.role("teacher", s.handleClassInvite))
	mux.HandleFunc("DELETE /api/classes/{id}/members/{userId}", s.role("teacher", s.handleRemoveMember))
	mux.HandleFunc("GET /api/classes/{id}/assignments", s.role("teacher", s.handleListAssignments))
	mux.HandleFunc("POST /api/classes/{id}/assignments", s.role("teacher", s.handleCreateAssignment))
	mux.HandleFunc("GET /api/classes/{id}/progress", s.role("teacher", s.handleClassProgress))
	mux.HandleFunc("GET /api/classes/{id}/grades.xlsx", s.role("teacher", s.handleClassGrades))
	mux.HandleFunc("PATCH /api/assignments/{id}", s.role("teacher", s.handleUpdateAssignment))
	mux.HandleFunc("DELETE /api/assignments/{id}", s.role("teacher", s.handleDeleteAssignment))
	mux.HandleFunc("GET /api/assignments/{id}/progress", s.role("teacher", s.handleAssignmentProgress))
	mux.HandleFunc("GET /api/assignments/{id}/grades.xlsx", s.role("teacher", s.handleAssignmentGrades))
	mux.HandleFunc("GET /api/teacher/invites", s.role("teacher", s.handleTeacherInvites))

	// admin
	mux.HandleFunc("GET /api/admin/overview", s.role("admin", s.handleAdminOverview))
	mux.HandleFunc("GET /api/admin/users", s.role("admin", s.handleListUsers))
	mux.HandleFunc("POST /api/admin/users", s.role("admin", s.handleCreateUser))
	mux.HandleFunc("PATCH /api/admin/users/{id}", s.role("admin", s.handleUpdateUser))
	mux.HandleFunc("DELETE /api/admin/users/{id}", s.role("admin", s.handleDeleteUser))
	mux.HandleFunc("GET /api/admin/invites", s.role("admin", s.handleListInvites))
	mux.HandleFunc("POST /api/admin/invites", s.role("admin", s.handleCreateInvites))
	mux.HandleFunc("POST /api/admin/invites/{id}/resend", s.role("admin", s.handleResendInvite))
	mux.HandleFunc("DELETE /api/admin/invites/{id}", s.role("admin", s.handleDeleteInvite))
	mux.HandleFunc("GET /api/admin/settings", s.role("admin", s.handleGetSettings))
	mux.HandleFunc("PUT /api/admin/settings/{key}", s.role("admin", s.handlePutSetting))
	mux.HandleFunc("POST /api/admin/smtp/test", s.role("admin", s.handleSMTPTest))
	mux.HandleFunc("GET /api/admin/providers", s.role("admin", s.handleListProviders))
	mux.HandleFunc("POST /api/admin/providers", s.role("admin", s.handleCreateProvider))
	mux.HandleFunc("PATCH /api/admin/providers/{id}", s.role("admin", s.handleUpdateProvider))
	mux.HandleFunc("DELETE /api/admin/providers/{id}", s.role("admin", s.handleDeleteProvider))
	mux.HandleFunc("POST /api/admin/providers/{id}/models", s.role("admin", s.handleRefreshModels))
	mux.HandleFunc("POST /api/admin/providers/{id}/test", s.role("admin", s.handleTestProvider))
	mux.HandleFunc("GET /api/admin/prices", s.role("admin", s.handleListPrices))
	mux.HandleFunc("PUT /api/admin/prices", s.role("admin", s.handlePutPrice))
	mux.HandleFunc("GET /api/admin/usage", s.role("admin", s.handleUsageSummary))
	mux.HandleFunc("GET /api/admin/usage/log", s.role("admin", s.handleUsageLog))

	// temporary rooms ("aula lampo")
	mux.HandleFunc("GET /api/guest/rooms/{code}", s.handleRoomLookup)
	mux.HandleFunc("POST /api/guest/join", s.handleRoomJoin)
	mux.HandleFunc("POST /api/guest/rejoin", s.handleRoomRejoin)
	mux.HandleFunc("GET /api/guest/room", s.auth(s.handleGuestRoom))
	mux.HandleFunc("POST /api/rooms", s.handleOpenRoom)
	mux.HandleFunc("GET /api/rooms", s.role("teacher", s.handleListRooms))
	mux.HandleFunc("GET /api/rooms/{id}", s.handleGetRoom)
	mux.HandleFunc("PATCH /api/rooms/{id}", s.handleUpdateRoom)
	mux.HandleFunc("DELETE /api/rooms/{id}", s.handleEndRoom)
	mux.HandleFunc("POST /api/rooms/{id}/guests/{userId}/pin", s.handleRoomGuestPIN)
	mux.HandleFunc("DELETE /api/rooms/{id}/guests/{userId}", s.handleRemoveRoomGuest)
	mux.HandleFunc("GET /api/rooms/{id}/guests/{userId}/sessions", s.handleRoomGuestSessions)
	mux.HandleFunc("GET /api/rooms/{id}/sessions/{sessionId}", s.handleRoomSession)
	mux.HandleFunc("GET /api/rooms/{id}/export.xlsx", s.handleRoomExportXLSX)
	mux.HandleFunc("GET /api/rooms/{id}/export.aula", s.handleRoomExportFile)
	mux.HandleFunc("POST /api/classes/{id}/room-import", s.role("teacher", s.handleRoomImport))
	mux.HandleFunc("POST /api/classes/{id}/room-import/preview", s.role("teacher", s.handleRoomImportPreview))
	mux.HandleFunc("GET /api/cron/purge-rooms", s.handleCronPurgeRooms)

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { writeErr(w, 404, "not_found", "API route not found") })
	mux.HandleFunc("/", s.serveStatic)

	return s.securityHeaders(s.originCheck(mux))
}

// ---------- static SPA ----------

func (s *Server) serveStatic(w http.ResponseWriter, r *http.Request) {
	var fsys fs.FS = s.static
	if s.cfg.StaticDir != "" {
		fsys = os.DirFS(s.cfg.StaticDir)
	}
	if fsys == nil {
		http.Error(w, "frontend not built", 404)
		return
	}
	p := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
	if p == "" {
		p = "index.html"
	}
	if f, err := fsys.Open(p); err == nil {
		st, _ := f.Stat()
		f.Close()
		if st != nil && !st.IsDir() {
			if strings.HasPrefix(p, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			http.ServeFileFS(w, r, fsys, p)
			return
		}
	}
	// SPA fallback
	b, err := fs.ReadFile(fsys, "index.html")
	if err != nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(200)
		_, _ = w.Write([]byte("<h1>DebateAI server is running</h1><p>The frontend is not built. Run <code>npm run build</code>.</p>"))
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write(b)
}

// ---------- middleware ----------

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("X-Frame-Options", "SAMEORIGIN")
		h.Set("Permissions-Policy", "microphone=(self)")
		next.ServeHTTP(w, r)
	})
}

// originCheck blocks cross-site state-changing requests (CSRF) for cookie auth.
func (s *Server) originCheck(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead && strings.HasPrefix(r.URL.Path, "/api/") {
			if o := r.Header.Get("Origin"); o != "" {
				u, err := url.Parse(o)
				if err != nil || !sameHost(u.Host, r.Host) {
					writeErr(w, 403, "bad_origin", "cross-origin request blocked")
					return
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}

func sameHost(a, b string) bool {
	strip := func(h string) string {
		if i := strings.LastIndex(h, ":"); i > 0 && !strings.Contains(h[i:], "]") {
			return h[:i]
		}
		return h
	}
	return strings.EqualFold(strip(a), strip(b))
}

type ctxKey int

const userKey ctxKey = 1

func currentUser(r *http.Request) *domain.User {
	u, _ := r.Context().Value(userKey).(*domain.User)
	return u
}

func (s *Server) withUser(r *http.Request) *http.Request {
	if u := s.userFromRequest(r); u != nil {
		return r.WithContext(context.WithValue(aiContext(r, u), userKey, u))
	}
	return r
}

func (s *Server) auth(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r = s.withUser(r)
		if currentUser(r) == nil {
			writeErr(w, 401, "unauthorized", "login required")
			return
		}
		h(w, r)
	}
}

// role allows the given role and everything above it (admin > teacher > student).
func (s *Server) role(min string, h http.HandlerFunc) http.HandlerFunc {
	rank := map[string]int{"student": 1, "teacher": 2, "admin": 3}
	return s.auth(func(w http.ResponseWriter, r *http.Request) {
		if rank[currentUser(r).Role] < rank[min] {
			writeErr(w, 403, "forbidden", "insufficient permissions")
			return
		}
		h(w, r)
	})
}

// ---------- helpers ----------

type apiError struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, apiError{Error: code, Message: msg})
}

func readJSON(r *http.Request, v any) error {
	return readJSONLimit(r, v, 8<<20)
}

func readJSONLimit(r *http.Request, v any, maxBytes int64) error {
	if r.Body == nil {
		return errors.New("empty body")
	}
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, maxBytes))
	return dec.Decode(v)
}

func pathID(r *http.Request, name string) int64 {
	n, _ := strconv.ParseInt(r.PathValue(name), 10, 64)
	return n
}

func (s *Server) clientIP(r *http.Request) string {
	return s.proxies.clientIP(r)
}

// baseURL is used to build links in e-mails.
func (s *Server) baseURL(r *http.Request) string {
	if g := s.Settings.General(); g.PublicURL != "" {
		return strings.TrimRight(g.PublicURL, "/")
	}
	if s.cfg.PublicURL != "" {
		return s.cfg.PublicURL
	}
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}

// ---------- rate limiting ----------

type rateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
}

type bucket struct {
	count int
	reset time.Time
}

func newRateLimiter() *rateLimiter {
	rl := &rateLimiter{buckets: map[string]*bucket{}}
	go func() {
		for range time.Tick(rateLimiterSweepEvery) {
			rl.mu.Lock()
			for k, b := range rl.buckets {
				if time.Now().After(b.reset) {
					delete(rl.buckets, k)
				}
			}
			rl.mu.Unlock()
		}
	}()
	return rl
}

// exhausted reports, without counting a hit, whether key reached limit.
func (rl *rateLimiter) exhausted(key string, limit int) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	b := rl.buckets[key]
	return b != nil && time.Now().Before(b.reset) && b.count >= limit
}

// allow returns false once `limit` hits happened within `window` for key.
func (rl *rateLimiter) allow(key string, limit int, window time.Duration) bool {
	if limit <= 0 {
		return true
	}
	rl.mu.Lock()
	defer rl.mu.Unlock()
	b := rl.buckets[key]
	if b == nil || time.Now().After(b.reset) {
		b = &bucket{reset: time.Now().Add(window)}
		rl.buckets[key] = b
	}
	if b.count >= limit {
		return false
	}
	b.count++
	return true
}

func ptr[T any](v T) *T { return &v }
