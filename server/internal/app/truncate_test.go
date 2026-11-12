package app

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestTruncateNeverSplitsALetter(t *testing.T) {
	for _, c := range []struct {
		in   string
		n    int
		want string
	}{
		{"abc", 5, "abc"},
		{"abcdef", 3, "abc"},
		{"èèè", 3, "è"}, // "è" is two bytes: the cut at 3 falls inside the second one
		{"èèè", 4, "èè"},
		{"ü€", 4, "ü"},
		{"", 3, ""},
	} {
		got := truncate(c.in, c.n)
		if got != c.want || !utf8.ValidString(got) {
			t.Errorf("truncate(%q, %d) = %q, want %q", c.in, c.n, got, c.want)
		}
	}
}

func TestTranscriptTextTailNeverSplitsALetter(t *testing.T) {
	msgs := []TranscriptMessage{{Role: "user", Content: strings.Repeat("è", 3000)}}
	for extra := range 4 {
		in := judgeInput{Transcript: msgs}
		if got := buildState(in, 1500+extra); !utf8.ValidString(got) {
			t.Fatalf("cut %d: the cut of an old part of the conversation left a broken letter", extra)
		}
	}
}
