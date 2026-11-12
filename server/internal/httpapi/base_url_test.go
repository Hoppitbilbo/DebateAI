package httpapi

import (
	"net/http/httptest"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
)

// Investigation 11/11, M4: with mail configured, links in e-mails never come
// from the request's Host header, which a client can forge.
func TestMailLinksIgnoreTheHostHeader(t *testing.T) {
	api := newTestAPI(t)
	r := httptest.NewRequest("POST", "/api/auth/forgot", nil)
	r.Host = "evil.example"
	if got := api.baseURL(r); got != "http://evil.example" {
		t.Fatalf("without mail (development) the request's host is used: %q", got)
	}
	if err := api.Settings.SaveSMTP(app.SMTPSettings{Host: "smtp.example", Port: 587}); err != nil {
		t.Fatal(err)
	}
	if got := api.baseURL(r); got != "" {
		t.Fatalf("with mail and no public address, no host from the request: %q", got)
	}
	g := api.Settings.General()
	g.PublicURL = "https://scuola.example/"
	if err := api.Settings.SaveGeneral(g); err != nil {
		t.Fatal(err)
	}
	if got := api.baseURL(r); got != "https://scuola.example" {
		t.Fatalf("the configured address wins: %q", got)
	}
}

func TestPublicURLFallsBackToVercelsProductionAddress(t *testing.T) {
	t.Setenv("PUBLIC_URL", "")
	t.Setenv("VERCEL_PROJECT_PRODUCTION_URL", "debateai.example")
	if got := app.LoadConfig().PublicURL; got != "https://debateai.example" {
		t.Fatalf("PublicURL = %q", got)
	}
	t.Setenv("PUBLIC_URL", "https://scuola.example/")
	if got := app.LoadConfig().PublicURL; got != "https://scuola.example" {
		t.Fatalf("PUBLIC_URL wins: %q", got)
	}
}
