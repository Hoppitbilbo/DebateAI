package ai

import (
	"context"
	"errors"
	"testing"
	"time"
)

// slowStreamer waits before its first delta, then streams the rest at once.
type slowStreamer struct {
	TextModel
	firstAfter time.Duration
}

func (s slowStreamer) Stream(ctx context.Context, req Request, onDelta func(string) error) (*Response, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(s.firstAfter):
	}
	_ = onDelta("a")
	select { // a slow tail must not be cut by the first-token timeout
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(3 * s.firstAfter):
	}
	_ = onDelta("b")
	return &Response{Text: "ab"}, nil
}

func TestFirstTokenTimeoutCancelsSilentStream(t *testing.T) {
	m := WithFirstTokenTimeout(slowStreamer{firstAfter: time.Second}, 20*time.Millisecond)
	_, err := m.Stream(context.Background(), Request{}, func(string) error { return nil })
	if !errors.Is(err, ErrFirstTokenTimeout) || err.Error() != "no answer within 20ms, trying next model" {
		t.Fatalf("got %v", err)
	}
}

func TestFirstTokenTimeoutLetsStartedStreamFinish(t *testing.T) {
	m := WithFirstTokenTimeout(slowStreamer{firstAfter: 10 * time.Millisecond}, 20*time.Millisecond)
	res, err := m.Stream(context.Background(), Request{}, func(string) error { return nil })
	if err != nil || res.Text != "ab" {
		t.Fatalf("got %v %+v", err, res)
	}
}
