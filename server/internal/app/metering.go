package app

import (
	"context"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

// Metering decorators: every call to a provider is timed and written to the
// usage log (and added to the session cost), whatever its outcome. entry
// carries who asked, for which task and with which provider/model.

type meteredTextModel struct {
	ai.TextModel
	s     *Server
	entry usageEntry
}

func (s *Server) meterText(m ai.TextModel, entry usageEntry) ai.TextModel {
	return meteredTextModel{TextModel: m, s: s, entry: entry}
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
	e := m.entry
	e.Latency = time.Since(start)
	if err != nil {
		e.Err = err.Error()
	} else {
		e.OK = true
		e.Usage = res.Usage
	}
	m.s.logUsage(e)
}

type meteredDecider struct {
	ai.Decider
	s     *Server
	entry usageEntry
}

func (s *Server) meterDecider(d ai.Decider, entry usageEntry) ai.Decider {
	return meteredDecider{Decider: d, s: s, entry: entry}
}

func (m meteredDecider) Decide(ctx context.Context, model string, state any, qs map[string]ai.JevQuestion) (*ai.JevResult, error) {
	start := time.Now()
	res, err := m.Decider.Decide(ctx, model, state, qs)
	e := m.entry
	e.Latency = time.Since(start)
	e.Usage = usageOr(res)
	if err != nil {
		e.Err = err.Error()
	} else {
		e.OK = true
	}
	m.s.logUsage(e)
	return res, err
}
