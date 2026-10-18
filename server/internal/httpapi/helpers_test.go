package httpapi

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
)

// testAPI is a server on a fresh database whose AI providers can be fakes:
// a provider whose name is a key of fakes is served by that fake.
type testAPI struct {
	*Server
	fakes map[string]ai.Provider
}

func newTestAPI(t *testing.T) *testAPI {
	t.Helper()
	dir := t.TempDir()
	cfg := app.Config{DataDir: dir, DatabasePath: filepath.Join(dir, "t.db"), Secret: "test-secret"}
	db, err := app.OpenDB(cfg.DatabasePath)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	api := &testAPI{fakes: map[string]ai.Provider{}}
	services := app.NewServices(cfg, db, app.WithProviderFactory(func(c ai.Config) (ai.Provider, error) {
		if p, ok := api.fakes[c.Name]; ok {
			return p, nil
		}
		return ai.New(c)
	}))
	api.Server = NewServer(cfg, services, nil)
	return api
}

// addFake registers a provider served by p and returns its id.
func (api *testAPI) addFake(t *testing.T, name, kind string, p ai.Provider) int64 {
	t.Helper()
	api.fakes[name] = p
	id, err := api.Providers.Create(name, kind, "", "")
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// fakeProvider is a text model that answers "answer from <model>".
type fakeProvider struct{}

func (fakeProvider) Generate(ctx context.Context, req ai.Request) (*ai.Response, error) {
	return &ai.Response{Text: "answer from " + req.Model, Usage: ai.Usage{InputTokens: 10, OutputTokens: 5}}, nil
}

func (fakeProvider) Stream(ctx context.Context, req ai.Request, onDelta func(string) error) (*ai.Response, error) {
	text := "answer from " + req.Model
	return &ai.Response{Text: text}, onDelta(text)
}

func (fakeProvider) ListModels(ctx context.Context) ([]ai.ModelInfo, error) { return nil, nil }

// fakeDecider is a Jev-like provider: it answers every question with the
// score in scores (0 when missing) and remembers the last request.
type fakeDecider struct {
	scores    map[string]float64
	state     any
	decisions int
}

func (d *fakeDecider) Decide(ctx context.Context, model string, state any, qs map[string]ai.JevQuestion) (*ai.JevResult, error) {
	d.state = state
	d.decisions++
	answers := map[string]ai.JevAnswer{}
	for k := range qs {
		v := d.scores[k]
		answers[k] = ai.JevAnswer{Type: "noul", Noul: &v}
	}
	return &ai.JevResult{Model: model, Answers: answers}, nil
}

func (d *fakeDecider) ListModels(ctx context.Context) ([]ai.ModelInfo, error) { return nil, nil }
