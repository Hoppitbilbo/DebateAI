package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// openAIProvider talks to any OpenAI-compatible /chat/completions endpoint:
// OpenAI, OpenCode Zen, OpenRouter, Groq, Cerebras, Mistral, DeepSeek,
// Together, Ollama, LM Studio, vLLM, llama.cpp server...
type openAIProvider struct{ cfg Config }

func newOpenAI(cfg Config) *openAIProvider { return &openAIProvider{cfg: cfg} }

type oaMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type oaRequest struct {
	Model          string         `json:"model"`
	Messages       []oaMessage    `json:"messages"`
	Temperature    *float64       `json:"temperature,omitempty"`
	MaxTokens      int            `json:"max_tokens,omitempty"`
	Stream         bool           `json:"stream,omitempty"`
	StreamOptions  map[string]any `json:"stream_options,omitempty"`
	ResponseFormat map[string]any `json:"response_format,omitempty"`
}

type oaUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
}

type oaResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
	Usage *oaUsage `json:"usage"`
}

func (p *openAIProvider) body(req Request, stream bool) oaRequest {
	msgs := make([]oaMessage, 0, len(req.Messages)+1)
	if req.System != "" {
		msgs = append(msgs, oaMessage{Role: "system", Content: req.System})
	}
	for _, m := range req.Messages {
		role := m.Role
		if role != "assistant" {
			role = "user"
		}
		msgs = append(msgs, oaMessage{Role: role, Content: m.Content})
	}
	out := oaRequest{Model: req.Model, Messages: msgs, Temperature: req.Temperature, MaxTokens: req.MaxTokens, Stream: stream}
	if stream {
		out.StreamOptions = map[string]any{"include_usage": true}
	}
	if req.JSON {
		out.ResponseFormat = map[string]any{"type": "json_object"}
	}
	return out
}

func (p *openAIProvider) do(ctx context.Context, method, path string, payload any) (*http.Response, error) {
	var rdr io.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		rdr = bytes.NewReader(b)
	}
	httpReq, err := http.NewRequestWithContext(ctx, method, trimSlash(p.cfg.BaseURL)+path, rdr)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if p.cfg.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.cfg.APIKey)
	}
	// OpenRouter uses these for attribution; harmless elsewhere.
	httpReq.Header.Set("X-Title", "DebateAI")
	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		resp.Body.Close()
		return nil, &HTTPError{Status: resp.StatusCode, Body: string(b)}
	}
	return resp, nil
}

func (p *openAIProvider) Generate(ctx context.Context, req Request) (*Response, error) {
	resp, err := p.do(ctx, http.MethodPost, "/chat/completions", p.body(req, false))
	if err != nil {
		// Some local servers reject response_format; retry once without it.
		if he, ok := err.(*HTTPError); ok && req.JSON && he.Status == 400 {
			req.JSON = false
			return p.Generate(ctx, req)
		}
		return nil, err
	}
	defer resp.Body.Close()
	var out oaResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if len(out.Choices) == 0 {
		return nil, fmt.Errorf("empty response from model")
	}
	r := &Response{Text: stripThinking(out.Choices[0].Message.Content)}
	if out.Usage != nil {
		r.Usage = Usage{InputTokens: out.Usage.PromptTokens, OutputTokens: out.Usage.CompletionTokens}
	} else {
		r.Usage = estimateUsage(req, r.Text)
	}
	return r, nil
}

func (p *openAIProvider) Stream(ctx context.Context, req Request, onDelta func(string) error) (*Response, error) {
	resp, err := p.do(ctx, http.MethodPost, "/chat/completions", p.body(req, true))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var full strings.Builder
	var usage *oaUsage
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			break
		}
		var chunk oaResponse
		if json.Unmarshal([]byte(data), &chunk) != nil {
			continue
		}
		if chunk.Usage != nil {
			usage = chunk.Usage
		}
		for _, c := range chunk.Choices {
			if c.Delta.Content != "" {
				full.WriteString(c.Delta.Content)
				if err := onDelta(c.Delta.Content); err != nil {
					return nil, err
				}
			}
		}
	}
	if err := sc.Err(); err != nil {
		return nil, err
	}
	r := &Response{Text: stripThinking(full.String())}
	if usage != nil {
		r.Usage = Usage{InputTokens: usage.PromptTokens, OutputTokens: usage.CompletionTokens}
	} else {
		r.Usage = estimateUsage(req, r.Text)
	}
	return r, nil
}

func (p *openAIProvider) ListModels(ctx context.Context) ([]ModelInfo, error) {
	resp, err := p.do(ctx, http.MethodGet, "/models", nil)
	if he, ok := err.(*HTTPError); ok && he.Status == 404 && strings.Contains(p.cfg.BaseURL, "/openai/v1") {
		// OpenCode serves chat under /inference/openai/v1 but lists models at /inference/v1/models.
		alt := &openAIProvider{cfg: p.cfg}
		alt.cfg.BaseURL = strings.Replace(p.cfg.BaseURL, "/openai/v1", "/v1", 1)
		resp, err = alt.do(ctx, http.MethodGet, "/models", nil)
	}
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out struct {
		Data []struct {
			ID      string `json:"id"`
			Name    string `json:"name"`
			Pricing *struct {
				Prompt     string `json:"prompt"`
				Completion string `json:"completion"`
			} `json:"pricing"`
		} `json:"data"`
		// Ollama native shape (when base URL points to /api)
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	res := make([]ModelInfo, 0, len(out.Data))
	for _, m := range out.Data {
		mi := ModelInfo{ID: m.ID, Name: m.Name, Free: IsLikelyFree(p.cfg.BaseURL, m.ID)}
		if m.Pricing != nil {
			in, e1 := strconv.ParseFloat(m.Pricing.Prompt, 64)
			outp, e2 := strconv.ParseFloat(m.Pricing.Completion, 64)
			if e1 == nil && e2 == nil {
				in, outp = in*1e6, outp*1e6
				mi.InputPerM, mi.OutputPerM = &in, &outp
				if in == 0 && outp == 0 {
					mi.Free = true
				}
			}
		}
		res = append(res, mi)
	}
	for _, m := range out.Models {
		res = append(res, ModelInfo{ID: m.Name, Free: true})
	}
	return res, nil
}

// stripThinking removes <think>...</think> blocks emitted by reasoning models
// (DeepSeek R1, Qwen, ...) served through local runtimes.
func stripThinking(s string) string {
	for {
		start := strings.Index(s, "<think>")
		if start < 0 {
			break
		}
		end := strings.Index(s[start:], "</think>")
		if end < 0 {
			s = s[:start]
			break
		}
		s = s[:start] + s[start+end+len("</think>"):]
	}
	return strings.TrimSpace(s)
}

// estimateUsage approximates token counts (~4 chars/token) for servers that do
// not report usage, so the cost dashboard still shows volumes.
func estimateUsage(req Request, out string) Usage {
	n := len(req.System)
	for _, m := range req.Messages {
		n += len(m.Content)
	}
	return Usage{InputTokens: n / 4, OutputTokens: len(out) / 4}
}
