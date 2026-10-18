// Package ai contains the provider adapters used by the AI gateway.
// Every provider exposes the same small interface so the router can
// switch between Gemini, OpenAI-compatible endpoints (OpenCode, OpenRouter,
// Groq, Ollama, LM Studio, ...), Anthropic and the Jev decision model.
package ai

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// Provider kinds understood by the gateway.
const (
	KindGemini    = "gemini"
	KindOpenAI    = "openai"
	KindAnthropic = "anthropic"
	KindJev       = "jev"
)

type Message struct {
	Role    string `json:"role"` // "user" | "assistant"
	Content string `json:"content"`
}

type Request struct {
	Model       string
	System      string
	Messages    []Message
	Temperature *float64
	MaxTokens   int
	JSON        bool
	// ReasoningEffort ("low", "medium", "high") limits hidden thinking on
	// reasoning models; empty leaves the provider default.
	ReasoningEffort string
}

type Usage struct {
	InputTokens  int `json:"inputTokens"`
	OutputTokens int `json:"outputTokens"`
	// CostUSD is the exact cost when the provider reports it (OpenRouter
	// does); it takes precedence over the price table. Needed for routers
	// such as typesafe/jev-router whose price depends on the routed model.
	CostUSD *float64 `json:"costUsd,omitempty"`
}

type Response struct {
	Text  string
	Usage Usage
}

// ModelInfo is returned by ListModels. Prices are USD per 1M tokens when the
// upstream API exposes them (OpenRouter does), otherwise nil.
type ModelInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name,omitempty"`
	InputPerM   *float64 `json:"inputPerM,omitempty"`
	OutputPerM  *float64 `json:"outputPerM,omitempty"`
	Free        bool     `json:"free"`
	SupportLive bool     `json:"supportLive,omitempty"`
}

type Config struct {
	ID      int64
	Name    string
	Kind    string
	BaseURL string
	APIKey  string
}

type Provider interface {
	Generate(ctx context.Context, req Request) (*Response, error)
	Stream(ctx context.Context, req Request, onDelta func(string) error) (*Response, error)
	ListModels(ctx context.Context) ([]ModelInfo, error)
}

// ErrUnsupported is returned when a provider kind cannot serve a capability
// (e.g. Jev cannot generate free text).
var ErrUnsupported = errors.New("operation not supported by this provider")

// HTTPError carries the upstream status so the router can decide whether a
// fallback makes sense (429/5xx) or not.
type HTTPError struct {
	Status int
	Body   string
}

func (e *HTTPError) Error() string {
	body := e.Body
	if len(body) > 400 {
		body = body[:400] + "..."
	}
	return fmt.Sprintf("upstream error %d: %s", e.Status, body)
}

func New(cfg Config) (Provider, error) {
	switch cfg.Kind {
	case KindGemini:
		return newGemini(cfg), nil
	case KindOpenAI:
		return newOpenAI(cfg), nil
	case KindAnthropic:
		return newAnthropic(cfg), nil
	case KindJev:
		return newJev(cfg), nil
	default:
		return nil, fmt.Errorf("unknown provider kind %q", cfg.Kind)
	}
}

var httpClient = &http.Client{Timeout: 180 * time.Second}

// IsLikelyFree guesses whether a model costs nothing: local servers and the
// "free" variants published by OpenRouter / OpenCode.
func IsLikelyFree(baseURL, model string) bool {
	u := strings.ToLower(baseURL)
	if strings.Contains(u, "localhost") || strings.Contains(u, "127.0.0.1") || strings.Contains(u, "0.0.0.0") ||
		strings.Contains(u, "host.docker.internal") || strings.Contains(u, ":11434") || strings.Contains(u, ":1234") {
		return true
	}
	m := strings.ToLower(model)
	return strings.HasSuffix(m, ":free") || strings.HasSuffix(m, "-free") || m == "big-pickle"
}

func trimSlash(s string) string { return strings.TrimRight(strings.TrimSpace(s), "/") }
