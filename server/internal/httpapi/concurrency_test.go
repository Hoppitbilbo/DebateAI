package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

type classroomProvider struct {
	fakeProvider
	started chan struct{}
	release chan struct{}
}

func (p classroomProvider) Generate(ctx context.Context, req ai.Request) (*ai.Response, error) {
	p.started <- struct{}{}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-p.release:
		return &ai.Response{Text: "answer for " + req.Messages[len(req.Messages)-1].Content,
			Usage: ai.Usage{InputTokens: 10, OutputTokens: 5}}, nil
	}
}

// Exercise real routing, cookies, SQLite, admission and metering with one
// school IP. The fake AI holds all 40 calls open together: this is a
// concurrency acceptance test, not a production throughput benchmark.
func TestConcurrentClassroomLoginsAndGenerations(t *testing.T) {
	const students = 40
	s, handler, class, _ := usernameClassAPI(t)
	school := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.RemoteAddr = "203.0.113.20:54321"
		handler.ServeHTTP(w, r)
	})
	p := classroomProvider{started: make(chan struct{}, students), release: make(chan struct{})}
	providerID := s.addFake(t, "classroom", ai.KindOpenAI, p)
	if err := s.Settings.SaveRouting(app.RoutingSettings{Strategy: "ordered", Tasks: map[string][]app.RouteTarget{
		app.TaskChat: {{ProviderID: providerID, Model: "classroom-model"}},
	}}); err != nil {
		t.Fatal(err)
	}
	// Seed accounts with a cheap hash: password hashing speed is not under test.
	hash, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	clients := make([]*client, students)
	userIDs := make([]int64, students)
	sessions := make([]domain.SessionSummary, students)
	for i := range students {
		name := fmt.Sprintf("student%02d", i)
		id, _, err := s.Users.CreateStudentInClass(domain.NewClassStudent{Code: class.JoinCode,
			Username: name, Name: name, PasswordHash: string(hash), Locale: "en"})
		if err != nil {
			t.Fatal(err)
		}
		userIDs[i] = id
		clients[i] = newHandlerClient(t, school)
	}
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i, c := range clients {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			name := fmt.Sprintf("student%02d", i)
			if code := c.do("POST", "/api/auth/login", map[string]string{"identifier": name, "password": "password123"}, nil); code != 200 {
				t.Errorf("%s login: %d", name, code)
				return
			}
			var me meResponse
			if code := c.do("GET", "/api/auth/me", nil, &me); code != 200 || me.User == nil || me.User.ID != userIDs[i] {
				t.Errorf("%s cookie resolved to a different account: %d %+v", name, code, me)
				return
			}
			if code := c.do("POST", "/api/sessions", map[string]string{"appType": "wiki-chatbot", "title": name}, &sessions[i]); code != 201 {
				t.Errorf("%s start session: %d", name, code)
			}
		}()
	}
	close(start)
	wg.Wait()
	if t.Failed() {
		return
	}
	for i, c := range clients {
		wg.Add(1)
		go func() {
			defer wg.Done()
			name := fmt.Sprintf("student%02d", i)
			var out generateResponse
			body := map[string]any{"recipe": wikiRecipe, "sessionId": sessions[i].ID,
				"messages": []ai.Message{{Role: ai.RoleUser, Content: name}}}
			if code := c.do("POST", "/api/ai/generate", body, &out); code != 200 || out.Text != "answer for "+name {
				t.Errorf("%s reply: %d %+v", name, code, out)
			}
		}()
	}
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	for i := range students {
		select {
		case <-p.started:
		case <-ctx.Done():
			t.Errorf("only %d of %d students reached the AI concurrently", i, students)
			close(p.release)
			wg.Wait()
			return
		}
	}
	close(p.release)
	wg.Wait()
	for i, c := range clients {
		if n, err := s.Usage.CountUserRequestsSince(userIDs[i], "2000-01-01T00:00:00Z", app.TaskJudge); err != nil || n != 1 {
			t.Errorf("student %d usage: %d, %v; want one call", i, n, err)
		}
		release, err := s.Gateway.Admit([]app.Admission{{Scope: fmt.Sprintf("user:%d", userIDs[i]), Limit: 1}})
		if err != nil {
			t.Errorf("student %d leaked a generation slot: %v", i, err)
		} else {
			release()
		}
		other := sessions[(i+1)%students].ID
		if code := c.do("GET", fmt.Sprintf("/api/sessions/%d", other), nil, nil); code != 404 {
			t.Errorf("student %d read another student's session: %d", i, code)
		}
	}
}
