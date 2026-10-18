package domain

import "testing"

func TestSessionStateTransitions(t *testing.T) {
	cases := []struct {
		name       string
		from       string
		outcome    TurnOutcome
		wantStatus string
		wantReason string
	}{
		{"keeps going", SessionActive, TurnOutcome{Turns: 1, MaxTurns: 5}, SessionActive, ""},
		{"unlimited turns", SessionActive, TurnOutcome{Turns: 99}, SessionActive, ""},
		{"goals met, auto end", SessionActive, TurnOutcome{Turns: 1, GoalsCompleted: true, AutoEnd: true}, SessionGoalReached, SessionGoalReached},
		{"goals met, no auto end", SessionActive, TurnOutcome{Turns: 1, GoalsCompleted: true}, SessionActive, ""},
		{"turn limit", SessionActive, TurnOutcome{Turns: 5, MaxTurns: 5}, SessionTurnLimit, SessionTurnLimit},
		{"goal wins over limit", SessionActive, TurnOutcome{Turns: 5, MaxTurns: 5, GoalsCompleted: true, AutoEnd: true}, SessionGoalReached, SessionGoalReached},
		{"ended stays ended", SessionTurnLimit, TurnOutcome{Turns: 9, GoalsCompleted: true, AutoEnd: true}, SessionTurnLimit, ""},
		{"completed is final", SessionCompleted, TurnOutcome{Turns: 9, MaxTurns: 1}, SessionCompleted, ""},
	}
	for _, c := range cases {
		next, reason := StateOf(c.from).Next(c.outcome)
		if next.Status() != c.wantStatus || reason != c.wantReason || next.Ended() != (c.wantStatus != SessionActive) {
			t.Errorf("%s: got %s/%q, want %s/%q", c.name, next.Status(), reason, c.wantStatus, c.wantReason)
		}
	}
}
