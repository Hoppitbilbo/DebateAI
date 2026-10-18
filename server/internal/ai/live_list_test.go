//go:build live

package ai

import (
	"context"
	"testing"
)

// go test -tags live ./internal/ai -run TestLiveListModels -v
func TestLiveListModels(t *testing.T) {
	for _, base := range []string{"https://openrouter.ai/api/v1", "https://opencode.ai/inference/openai/v1"} {
		p, _ := New(Config{Kind: KindOpenAI, BaseURL: base})
		m, err := p.ListModels(context.Background())
		free := 0
		for _, x := range m {
			if x.Free {
				free++
			}
		}
		t.Logf("%s: %d models (%d free), err=%v", base, len(m), free, err)
		if err != nil || len(m) == 0 {
			t.Fail()
		}
	}
}
