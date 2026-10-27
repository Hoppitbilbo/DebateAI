package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

// anthropicProvider speaks the native Messages API (api.anthropic.com or the
// OpenCode /inference/anthropic gateway).
type anthropicProvider struct{ cfg Config }

func newAnthropic(cfg Config) *anthropicProvider { return &anthropicProvider{cfg: cfg} }

type anMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anRequest struct {
	Model       string      `json:"model"`
	System      string      `json:"system,omitempty"`
	Messages    []anMessage `json:"messages"`
	MaxTokens   int         `json:"max_tokens"`
	Temperature *float64    `json:"temperature,omitempty"`
	Stream      bool        `json:"stream,omitempty"`
}

type anUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

func (p *anthropicProvider) base() string {
	if p.cfg.BaseURL == "" {
		return "https://api.anthropic.com/v1"
	}
	return trimSlash(p.cfg.BaseURL)
}

func (p *anthropicProvider) build(req Request, stream bool) anRequest {
	msgs := make([]anMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		role := RoleUser
		if m.Role == RoleAssistant {
			role = RoleAssistant
		}
		if n := len(msgs); n > 0 && msgs[n-1].Role == role {
			msgs[n-1].Content += "\n\n" + m.Content
			continue
		}
		msgs = append(msgs, anMessage{Role: role, Content: m.Content})
	}
	// The Messages API requires the first turn to come from the user.
	if len(msgs) == 0 || msgs[0].Role != RoleUser {
		msgs = append([]anMessage{{Role: RoleUser, Content: "(start)"}}, msgs...)
	}
	system := req.System
	if req.JSON {
		system += "\n\nRespond with a single valid JSON object and nothing else."
	}
	max := req.MaxTokens
	if max <= 0 {
		max = 2048
	}
	return anRequest{Model: req.Model, System: strings.TrimSpace(system), Messages: msgs, MaxTokens: max, Temperature: req.Temperature, Stream: stream}
}

func (p *anthropicProvider) post(ctx context.Context, payload any) (*http.Response, error) {
	b, _ := json.Marshal(payload)
	r, err := http.NewRequestWithContext(ctx, http.MethodPost, p.base()+"/messages", bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("x-api-key", p.cfg.APIKey)
	r.Header.Set("Authorization", "Bearer "+p.cfg.APIKey)
	r.Header.Set("anthropic-version", "2023-06-01")
	resp, err := httpClient.Do(r)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		resp.Body.Close()
		return nil, &HTTPError{Status: resp.StatusCode, Body: string(body)}
	}
	return resp, nil
}

func (p *anthropicProvider) Generate(ctx context.Context, req Request) (*Response, error) {
	resp, err := p.post(ctx, p.build(req, false))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		Usage anUsage `json:"usage"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	var sb strings.Builder
	for _, c := range out.Content {
		if c.Type == "text" {
			sb.WriteString(c.Text)
		}
	}
	return &Response{Text: sb.String(), Usage: Usage{InputTokens: out.Usage.InputTokens, OutputTokens: out.Usage.OutputTokens}}, nil
}

func (p *anthropicProvider) Stream(ctx context.Context, req Request, onDelta func(string) error) (*Response, error) {
	resp, err := p.post(ctx, p.build(req, true))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var full strings.Builder
	var usage Usage
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		var ev struct {
			Type  string `json:"type"`
			Delta struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
			Message struct {
				Usage anUsage `json:"usage"`
			} `json:"message"`
			Usage anUsage `json:"usage"`
		}
		if json.Unmarshal([]byte(strings.TrimSpace(line[5:])), &ev) != nil {
			continue
		}
		switch ev.Type {
		case "message_start":
			usage.InputTokens = ev.Message.Usage.InputTokens
		case "content_block_delta":
			if ev.Delta.Text != "" {
				full.WriteString(ev.Delta.Text)
				if err := onDelta(ev.Delta.Text); err != nil {
					return nil, err
				}
			}
		case "message_delta":
			usage.OutputTokens = ev.Usage.OutputTokens
		}
	}
	return &Response{Text: full.String(), Usage: usage}, sc.Err()
}

func (p *anthropicProvider) ListModels(ctx context.Context) ([]ModelInfo, error) {
	r, err := http.NewRequestWithContext(ctx, http.MethodGet, p.base()+"/models?limit=100", nil)
	if err != nil {
		return nil, err
	}
	r.Header.Set("x-api-key", p.cfg.APIKey)
	r.Header.Set("anthropic-version", "2023-06-01")
	resp, err := httpClient.Do(r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, &HTTPError{Status: resp.StatusCode, Body: string(b)}
	}
	var out struct {
		Data []struct {
			ID          string `json:"id"`
			DisplayName string `json:"display_name"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	res := make([]ModelInfo, 0, len(out.Data))
	for _, m := range out.Data {
		res = append(res, ModelInfo{ID: m.ID, Name: m.DisplayName})
	}
	return res, nil
}
