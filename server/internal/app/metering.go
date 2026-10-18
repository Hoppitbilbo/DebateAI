package app

import (
	"context"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

// Metering decorators: every call to a provider is timed and written to the
// usage log (and added to the session cost), whatever its outcome. entry
// carries who asked, for which task and with which provider/model.

// recordUsage completes entry with the outcome of a call that started at
// start and writes it to the usage log.
func (g *aiGateway) recordUsage(entry usageEntry, start time.Time, usage ai.Usage, err error) {
	entry.Latency = time.Since(start)
	entry.Usage = usage
	if err != nil {
		entry.Err = err.Error()
	} else {
		entry.OK = true
	}
	g.logUsage(entry)
}

type meteredTextModel struct {
	ai.TextModel
	gw    *aiGateway
	entry usageEntry
}

func (g *aiGateway) meterText(m ai.TextModel, entry usageEntry) ai.TextModel {
	return meteredTextModel{TextModel: m, gw: g, entry: entry}
}

func (m meteredTextModel) Generate(ctx context.Context, req ai.Request) (*ai.Response, error) {
	start := time.Now()
	res, err := m.TextModel.Generate(ctx, req)
	m.record(start, res, err)
	return res, err
}

func (m meteredTextModel) Stream(ctx context.Context, req ai.Request, onDelta func(string) error) (*ai.Response, error) {
	start := time.Now()
	res, err := m.TextModel.Stream(ctx, req, onDelta)
	m.record(start, res, err)
	return res, err
}

func (m meteredTextModel) record(start time.Time, res *ai.Response, err error) {
	var usage ai.Usage
	if res != nil {
		usage = res.Usage
	}
	m.gw.recordUsage(m.entry, start, usage, err)
}

type meteredDecider struct {
	ai.Decider
	gw    *aiGateway
	entry usageEntry
}

func (g *aiGateway) meterDecider(d ai.Decider, entry usageEntry) ai.Decider {
	return meteredDecider{Decider: d, gw: g, entry: entry}
}

func (m meteredDecider) Decide(ctx context.Context, model string, state any, qs map[string]ai.JevQuestion) (*ai.JevResult, error) {
	start := time.Now()
	res, err := m.Decider.Decide(ctx, model, state, qs)
	m.gw.recordUsage(m.entry, start, usageOr(res), err)
	return res, err
}
