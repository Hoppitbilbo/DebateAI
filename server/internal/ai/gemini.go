package ai

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"google.golang.org/genai"
)

// geminiProvider uses the official Google Gen AI Go SDK.
type geminiProvider struct {
	cfg Config

	once   sync.Once
	client *genai.Client
	err    error
}

func newGemini(cfg Config) *geminiProvider { return &geminiProvider{cfg: cfg} }

func (p *geminiProvider) getClient(ctx context.Context) (*genai.Client, error) {
	p.once.Do(func() {
		cc := &genai.ClientConfig{APIKey: p.cfg.APIKey, Backend: genai.BackendGeminiAPI}
		if p.cfg.BaseURL != "" {
			cc.HTTPOptions = genai.HTTPOptions{BaseURL: p.cfg.BaseURL}
		}
		p.client, p.err = genai.NewClient(ctx, cc)
	})
	return p.client, p.err
}

func (p *geminiProvider) build(req Request) ([]*genai.Content, *genai.GenerateContentConfig) {
	contents := make([]*genai.Content, 0, len(req.Messages))
	for _, m := range req.Messages {
		role := genai.Role(genai.RoleUser)
		if m.Role == "assistant" {
			role = genai.RoleModel
		}
		// Gemini rejects consecutive turns with the same role: merge them.
		if n := len(contents); n > 0 && contents[n-1].Role == string(role) {
			contents[n-1].Parts = append(contents[n-1].Parts, genai.NewPartFromText(m.Content))
			continue
		}
		contents = append(contents, genai.NewContentFromText(m.Content, role))
	}
	cfg := &genai.GenerateContentConfig{}
	if req.System != "" {
		cfg.SystemInstruction = genai.NewContentFromText(req.System, genai.RoleUser)
	}
	if req.Temperature != nil {
		t := float32(*req.Temperature)
		cfg.Temperature = &t
	}
	if req.MaxTokens > 0 {
		cfg.MaxOutputTokens = int32(req.MaxTokens)
	}
	if req.JSON {
		cfg.ResponseMIMEType = "application/json"
	}
	return contents, cfg
}

func usageOf(r *genai.GenerateContentResponse) Usage {
	if r == nil || r.UsageMetadata == nil {
		return Usage{}
	}
	u := r.UsageMetadata
	return Usage{
		InputTokens:  int(u.PromptTokenCount + u.ToolUsePromptTokenCount),
		OutputTokens: int(u.CandidatesTokenCount + u.ThoughtsTokenCount),
	}
}

func (p *geminiProvider) Generate(ctx context.Context, req Request) (*Response, error) {
	c, err := p.getClient(ctx)
	if err != nil {
		return nil, err
	}
	contents, cfg := p.build(req)
	res, err := c.Models.GenerateContent(ctx, req.Model, contents, cfg)
	if err != nil {
		return nil, wrapGeminiErr(err)
	}
	text := res.Text()
	if strings.TrimSpace(text) == "" {
		return nil, errors.New("empty response from Gemini (possibly blocked by safety filters)")
	}
	return &Response{Text: text, Usage: usageOf(res)}, nil
}

func (p *geminiProvider) Stream(ctx context.Context, req Request, onDelta func(string) error) (*Response, error) {
	c, err := p.getClient(ctx)
	if err != nil {
		return nil, err
	}
	contents, cfg := p.build(req)
	var full strings.Builder
	var usage Usage
	for chunk, err := range c.Models.GenerateContentStream(ctx, req.Model, contents, cfg) {
		if err != nil {
			return nil, wrapGeminiErr(err)
		}
		if u := usageOf(chunk); u.InputTokens+u.OutputTokens > 0 {
			usage = u
		}
		if t := chunk.Text(); t != "" {
			full.WriteString(t)
			if err := onDelta(t); err != nil {
				return nil, err
			}
		}
	}
	return &Response{Text: full.String(), Usage: usage}, nil
}

func (p *geminiProvider) ListModels(ctx context.Context) ([]ModelInfo, error) {
	c, err := p.getClient(ctx)
	if err != nil {
		return nil, err
	}
	var out []ModelInfo
	page, err := c.Models.List(ctx, &genai.ListModelsConfig{PageSize: 200})
	for err == nil {
		for _, m := range page.Items {
			id := strings.TrimPrefix(m.Name, "models/")
			mi := ModelInfo{ID: id, Name: m.DisplayName}
			for _, a := range m.SupportedActions {
				if a == "bidiGenerateContent" {
					mi.SupportLive = true
				}
			}
			out = append(out, mi)
		}
		page, err = page.Next(ctx)
	}
	if err != nil && !errors.Is(err, genai.ErrPageDone) {
		return out, err
	}
	return out, nil
}

// LiveTokenOptions describes the Live session the browser is allowed to open.
type LiveTokenOptions struct {
	Model             string
	SystemInstruction string
	VoiceName         string
	TTL               time.Duration
}

// CreateLiveToken mints a single-use ephemeral token for the Gemini Live API,
// so the browser can open the WebSocket directly without ever seeing the real
// API key. The model and system instruction are locked into the token.
func CreateLiveToken(ctx context.Context, cfg Config, opts LiveTokenOptions) (string, time.Time, error) {
	cc := &genai.ClientConfig{
		APIKey:      cfg.APIKey,
		Backend:     genai.BackendGeminiAPI,
		HTTPOptions: genai.HTTPOptions{APIVersion: "v1alpha"},
	}
	client, err := genai.NewClient(ctx, cc)
	if err != nil {
		return "", time.Time{}, err
	}
	if opts.TTL <= 0 {
		opts.TTL = 30 * time.Minute
	}
	expire := time.Now().Add(opts.TTL)
	uses := int32(1)

	live := &genai.LiveConnectConfig{
		ResponseModalities:      []genai.Modality{genai.ModalityAudio},
		InputAudioTranscription: &genai.AudioTranscriptionConfig{},
		OutputAudioTranscription: &genai.AudioTranscriptionConfig{},
	}
	if opts.SystemInstruction != "" {
		live.SystemInstruction = genai.NewContentFromText(opts.SystemInstruction, genai.RoleUser)
	}
	if opts.VoiceName != "" {
		live.SpeechConfig = &genai.SpeechConfig{VoiceConfig: &genai.VoiceConfig{
			PrebuiltVoiceConfig: &genai.PrebuiltVoiceConfig{VoiceName: opts.VoiceName},
		}}
	}
	tok, err := client.AuthTokens.Create(ctx, &genai.CreateAuthTokenConfig{
		HTTPOptions:          &genai.HTTPOptions{APIVersion: "v1alpha"},
		ExpireTime:           expire,
		NewSessionExpireTime: time.Now().Add(2 * time.Minute),
		Uses:                 &uses,
		LiveConnectConstraints: &genai.LiveConnectConstraints{
			Model:  normalizeModelName(opts.Model),
			Config: live,
		},
	})
	if err != nil {
		return "", time.Time{}, wrapGeminiErr(err)
	}
	return tok.Name, expire, nil
}

func normalizeModelName(m string) string {
	if strings.HasPrefix(m, "models/") {
		return m
	}
	return "models/" + m
}

func wrapGeminiErr(err error) error {
	var apiErr genai.APIError
	if errors.As(err, &apiErr) {
		return &HTTPError{Status: apiErr.Code, Body: apiErr.Message}
	}
	return fmt.Errorf("gemini: %w", err)
}
