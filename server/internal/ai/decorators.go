package ai

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"time"
)

// ErrFirstTokenTimeout marks a stream cancelled because the model stayed
// silent too long; a router may try another model.
var ErrFirstTokenTimeout = errors.New("trying next model")

// WithFirstTokenTimeout decorates a TextModel: a stream that sends no delta
// within d is cancelled and fails with ErrFirstTokenTimeout. Once the first
// delta arrives the stream may take as long as it needs. Generate is unchanged.
func WithFirstTokenTimeout(m TextModel, d time.Duration) TextModel {
	return firstTokenTimeout{TextModel: m, timeout: d}
}

type firstTokenTimeout struct {
	TextModel
	timeout time.Duration
}

func (f firstTokenTimeout) Stream(ctx context.Context, req Request, onDelta func(string) error) (*Response, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	var started, timedOut atomic.Bool
	timer := time.AfterFunc(f.timeout, func() {
		if !started.Load() {
			timedOut.Store(true)
			cancel()
		}
	})
	defer timer.Stop()
	res, err := f.TextModel.Stream(ctx, req, func(d string) error {
		if !started.Swap(true) {
			timer.Stop()
		}
		return onDelta(d)
	})
	if err != nil && timedOut.Load() {
		return nil, fmt.Errorf("no answer within %s, %w", f.timeout, ErrFirstTokenTimeout)
	}
	return res, err
}
