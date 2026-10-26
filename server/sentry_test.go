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
