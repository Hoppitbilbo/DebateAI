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
	gw       *aiGateway
	entry    usageEntry
	provider *firstDeltaClock // optional: when the provider's first text came
}

func (g *aiGateway) meterText(m ai.TextModel, entry usageEntry) ai.TextModel {
	return meteredTextModel{TextModel: m, gw: g, entry: entry}
}

// meterTimed is meterText that also logs when the provider sent its first
// text (clock, the innermost decorator) as well as when the student saw it.
func (g *aiGateway) meterTimed(m ai.TextModel, entry usageEntry, clock *firstDeltaClock) ai.TextModel {
	return meteredTextModel{TextModel: m, gw: g, entry: entry, provider: clock}
}

// firstDeltaClock notes when the provider sent its first text, before the
// answer screening may hold it back.
// It also counts the provider's text, which estimates the usage of a stream
// stopped while its opening was still held back.
type firstDeltaClock struct {
	ai.TextModel
	at    time.Time
	chars int
}

func (c *firstDeltaClock) Stream(ctx context.Context, req ai.Request, onDelta func(string) error) (*ai.Response, error) {
	return c.TextModel.Stream(ctx, req, func(d string) error {
		if c.at.IsZero() {
			c.at = time.Now()
		}
		c.chars += len(d)
		return onDelta(d)
	})
}

func (m meteredTextModel) Generate(ctx context.Context, req ai.Request) (*ai.Response, error) {
	start := time.Now()
	res, err := m.TextModel.Generate(ctx, req)
	m.record(start, req, res, 0, err)
	return res, err
}

func (m meteredTextModel) Stream(ctx context.Context, req ai.Request, onDelta func(string) error) (*ai.Response, error) {
	start := time.Now()
	streamed := 0
	res, err := m.TextModel.Stream(ctx, req, func(d string) error {
		if streamed == 0 {
			m.entry.FirstText = time.Since(start)
		}
		streamed += len(d)
		return onDelta(d)
	})
	if m.provider != nil && !m.provider.at.IsZero() {
		m.entry.FirstDelta = m.provider.at.Sub(start)
		streamed = max(streamed, m.provider.chars) // generated, even if not shown
	}
	m.record(start, req, res, streamed, err)
	return res, err
}

// record logs the call. A stream that produced text but no usage (it was
// interrupted, or the provider sent none) is logged with tokens estimated
// from the text, marked as estimated.
func (m meteredTextModel) record(start time.Time, req ai.Request, res *ai.Response, streamed int, err error) {
	var usage ai.Usage
	if res != nil {
		usage = res.Usage
	}
	if usage.InputTokens == 0 && usage.OutputTokens == 0 && usage.CostUSD == nil && streamed > 0 {
		usage = ai.Usage{InputTokens: requestChars(req) / estimatedCharsPerToken, OutputTokens: streamed / estimatedCharsPerToken}
		m.entry.Estimated = true
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
