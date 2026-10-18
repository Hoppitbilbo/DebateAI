package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

// Jev is TypeSafe AI's "System One" decision model, served by OpenCode at
// https://opencode.ai/inference/systemone/v1/systemone. Instead of producing
// text it scores a `state` against typed questions (noul / choice / score)
// and returns calibrated values. We use it to decide whether the teacher's
// assignment has been completed.
type jevProvider struct{ cfg Config }

func newJev(cfg Config) *jevProvider { return &jevProvider{cfg: cfg} }

const DefaultJevURL = "https://opencode.ai/inference/systemone/v1/systemone"

// JevQuestion mirrors the System One request schema.
type JevQuestion struct {
	Type         string `json:"type"` // noul | choice | score
	Instructions string `json:"instructions"`
	Criteria     any    `json:"criteria,omitempty"`
}

type JevAnswer struct {
	Type          string             `json:"type"`
	Noul          *float64           `json:"noul,omitempty"`
	Score         *float64           `json:"score,omitempty"`
	Choice        string             `json:"choice,omitempty"`
	Probabilities map[string]float64 `json:"probabilities,omitempty"`
	Confidence    *float64           `json:"confidence,omitempty"`
}

type JevResult struct {
	Model   string               `json:"model"`
	Answers map[string]JevAnswer `json:"answers"`
	Usage   Usage                `json:"-"`
}

// Decider is implemented by providers that can answer structured questions.
type Decider interface {
	Decide(ctx context.Context, model, state string, questions map[string]JevQuestion) (*JevResult, error)
}

func (p *jevProvider) url() string {
	if p.cfg.BaseURL == "" {
		return DefaultJevURL
	}
	u := trimSlash(p.cfg.BaseURL)
	if !strings.HasSuffix(u, "/systemone") {
		u += "/systemone"
	}
	return u
}

func (p *jevProvider) Decide(ctx context.Context, model, state string, questions map[string]JevQuestion) (*JevResult, error) {
	payload := map[string]any{"model": model, "state": state, "questions": questions}
	b, _ := json.Marshal(payload)
	r, err := http.NewRequestWithContext(ctx, http.MethodPost, p.url(), bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Authorization", "Bearer "+p.cfg.APIKey)
	resp, err := httpClient.Do(r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, &HTTPError{Status: resp.StatusCode, Body: string(body)}
	}
	var out struct {
		Model   string               `json:"model"`
		Answers map[string]JevAnswer `json:"answers"`
		Usage   struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &JevResult{Model: out.Model, Answers: out.Answers, Usage: Usage{InputTokens: out.Usage.InputTokens, OutputTokens: out.Usage.OutputTokens}}, nil
}

func (p *jevProvider) Generate(context.Context, Request) (*Response, error) {
	return nil, ErrUnsupported
}

func (p *jevProvider) Stream(context.Context, Request, func(string) error) (*Response, error) {
	return nil, ErrUnsupported
}

func (p *jevProvider) ListModels(context.Context) ([]ModelInfo, error) {
	return []ModelInfo{
		{ID: "jev-1.13-free", Name: "Jev 1.13 Free", Free: true},
		{ID: "jev-1.13", Name: "Jev 1.13"},
	}, nil
}
