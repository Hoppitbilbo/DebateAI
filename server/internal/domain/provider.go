package domain

import "github.com/Hoppitbilbo/DebateAI/server/internal/ai"

// Provider is a configured AI provider. The API key is stored encrypted;
// only the application can decrypt it.
type Provider struct {
	ID        int64
	Name      string
	Kind      string
	BaseURL   string
	APIKeyEnc string
	Models    []ai.ModelInfo
	Enabled   bool
	CreatedAt string
}

// ProviderPatch lists the provider fields to change; nil fields stay as they are.
type ProviderPatch struct {
	Name      *string
	BaseURL   *string
	APIKeyEnc *string
	Enabled   *bool
}

// ModelPrice is the price of a model in USD per 1M tokens.
type ModelPrice struct {
	ProviderID   int64   `json:"providerId"`
	ProviderName string  `json:"providerName"`
	Model        string  `json:"model"`
	InputPerM    float64 `json:"inputPerM"`
	OutputPerM   float64 `json:"outputPerM"`
}

// UsageRecord is one AI call to write to the usage log.
type UsageRecord struct {
	UserID       *int64
	SessionID    *int64
	ProviderID   int64
	Provider     string
	Model        string
	Task         string
	InputTokens  int
	OutputTokens int
	CostUSD      float64
	OK           bool
	LatencyMs    int64
	Error        string
	// Estimated: the provider reported no usage (e.g. an interrupted
	// stream), the tokens are estimated from the text length.
	Estimated bool
	// Unpriced: the model has no known price, so CostUSD is 0 but unknown.
	Unpriced bool
}

// UsageLogRow is one line of the usage log as the admin sees it.
type UsageLogRow struct {
	ID           int64   `json:"id"`
	CreatedAt    string  `json:"createdAt"`
	User         string  `json:"user"`
	SessionID    *int64  `json:"sessionId,omitempty"`
	Provider     string  `json:"provider"`
	Model        string  `json:"model"`
	Task         string  `json:"task"`
	InputTokens  int     `json:"inputTokens"`
	OutputTokens int     `json:"outputTokens"`
	CostUSD      float64 `json:"costUsd"`
	OK           bool    `json:"ok"`
	LatencyMs    int     `json:"latencyMs"`
	Error        string  `json:"error,omitempty"`
	Estimated    bool    `json:"estimated,omitempty"`
	Unpriced     bool    `json:"unpriced,omitempty"`
}

// UsageAggregate sums the usage log over one group (a day, a model, ...).
type UsageAggregate struct {
	Key          string  `json:"key"`
	Label        string  `json:"label,omitempty"`
	Requests     int     `json:"requests"`
	Errors       int     `json:"errors"`
	InputTokens  int64   `json:"inputTokens"`
	OutputTokens int64   `json:"outputTokens"`
	CostUSD      float64 `json:"costUsd"`
}

// UsageGrouping is how usage is aggregated.
type UsageGrouping int

const (
	UsageByDay UsageGrouping = iota
	UsageByModel
	UsageByTask
	UsageByProvider
	UsageByUser
	UsageByClass
)
