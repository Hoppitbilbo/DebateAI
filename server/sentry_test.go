package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
)

type eventTransport struct{ events []*sentry.Event }

func (t *eventTransport) Configure(sentry.ClientOptions)        {}
func (t *eventTransport) SendEvent(e *sentry.Event)             { t.events = append(t.events, e) }
func (t *eventTransport) Flush(time.Duration) bool              { return true }
func (t *eventTransport) FlushWithContext(context.Context) bool { return true }
func (t *eventTransport) Close()                                {}

func TestSentryHTTPPrivacyAndPanic(t *testing.T) {
	t.Setenv("SENTRY_DSN", "https://public@example.invalid/1")
	t.Setenv("SENTRY_ENVIRONMENT", "test")
	transport := &eventTransport{}
	options := sentryOptions()
	options.Transport = transport
	client, err := sentry.NewClient(options)
	if err != nil {
		t.Fatal(err)
	}
	previous := sentry.CurrentHub().Client()
	sentry.CurrentHub().BindClient(client)
	t.Cleanup(func() { sentry.CurrentHub().BindClient(previous); client.Close() })
	handler := monitorHTTP(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil || string(body) != "student-conversation-secret" {
			t.Error("monitoring changed the request body")
		}
		panic("Sentry middleware verification")
	}))
	req := httptest.NewRequest("POST", "http://example.test/api/test?token=query-secret", strings.NewReader("student-conversation-secret"))
	req.Header.Set("Authorization", "Bearer auth-secret")
	req.Header.Set("Cookie", "session=cookie-secret")
	func() {
		defer func() {
			if recover() == nil {
				t.Error("middleware must preserve net/http panic handling")
			}
		}()
		handler.ServeHTTP(httptest.NewRecorder(), req)
	}()
	var captured bool
	for _, event := range transport.events {
		if len(event.Exception) > 0 || event.Message == "Sentry middleware verification" {
			captured = true
			var stacks []*sentry.Stacktrace
			for _, exception := range event.Exception {
				stacks = append(stacks, exception.Stacktrace)
			}
			for _, thread := range event.Threads {
				stacks = append(stacks, thread.Stacktrace)
			}
			readable := false
			for _, stack := range stacks {
				if stack == nil {
					continue
				}
				for _, frame := range stack.Frames {
					if strings.Contains(frame.Function, "TestSentryHTTPPrivacyAndPanic") && frame.Lineno > 0 && (strings.HasSuffix(frame.AbsPath, "sentry_test.go") || strings.HasSuffix(frame.Filename, "sentry_test.go")) {
						readable = true
					}
				}
			}
			if !readable {
				t.Error("panic lacks a readable application frame")
			}
		}
		payload, err := json.Marshal(event)
		if err != nil {
			t.Fatal(err)
		}
		for _, secret := range []string{"query-secret", "auth-secret", "cookie-secret", "student-conversation-secret"} {
			if strings.Contains(string(payload), secret) {
				t.Errorf("telemetry contains %s", secret)
			}
		}
	}
	if !captured {
		t.Fatal("panic was not captured")
	}
}

func TestSentryEnvironmentAndReleaseOnVercel(t *testing.T) {
	t.Setenv("SENTRY_ENVIRONMENT", "")
	t.Setenv("SENTRY_RELEASE", "")
	t.Setenv("VERCEL_GIT_COMMIT_SHA", "abc123")
	previous := buildRelease
	buildRelease = ""
	t.Cleanup(func() { buildRelease = previous })
	for vercelEnv, want := range map[string]string{"preview": "test", "development": "development", "production": "production", "": "production"} {
		t.Setenv("VERCEL_ENV", vercelEnv)
		if got := environmentName(); got != want {
			t.Errorf("VERCEL_ENV=%q: environment %q, want %q", vercelEnv, got, want)
		}
	}
	t.Setenv("SENTRY_ENVIRONMENT", "staging")
	if got := environmentName(); got != "staging" {
		t.Errorf("SENTRY_ENVIRONMENT must win, got %q", got)
	}
	if got := releaseName(); got != "abc123" {
		t.Errorf("release %q, want the Vercel commit", got)
	}
	t.Setenv("SENTRY_RELEASE", "explicit")
	if got := releaseName(); got != "explicit" {
		t.Errorf("SENTRY_RELEASE must win, got %q", got)
	}
}

func TestSentryTracesSampler(t *testing.T) {
	sample := tracesSampler("production")
	rate := func(name string, parent sentry.Sampled) float64 {
		return sample(sentry.SamplingContext{Span: &sentry.Span{Name: name}, ParentSampled: parent})
	}
	for _, name := range []string{"POST /api/ai/generate", "POST /api/sessions/12/evaluate"} {
		if got := rate(name, sentry.SampledFalse); got != 1 {
			t.Errorf("%s: rate %v, want every AI request", name, got)
		}
	}
	if got := rate("GET /api/ai/status", sentry.SampledUndefined); got != prodTracesSampleRate {
		t.Errorf("other requests: rate %v, want %v", got, prodTracesSampleRate)
	}
	if got := rate("GET /api/me", sentry.SampledTrue); got != 1 {
		t.Errorf("a sampled browser trace must continue, got %v", got)
	}
	if got := rate("GET /api/me", sentry.SampledFalse); got != 0 {
		t.Errorf("an unsampled browser trace must stay unsampled, got %v", got)
	}
	if got := tracesSampler("test")(sentry.SamplingContext{Span: &sentry.Span{Name: "GET /api/me"}}); got != 1 {
		t.Errorf("test environment: rate %v, want 1", got)
	}
}
