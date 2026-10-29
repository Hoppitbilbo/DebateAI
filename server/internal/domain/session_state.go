package domain

// Session lifecycle (State pattern): each status decides how the session
// reacts to a finished student turn. Only an active session can move on;
// every other status is final for the conversation.
//
//	active ──goals met & auto end──▶ goal_reached
//	active ──character identified─▶ goal_reached (reason "identified", mystery game)
//	active ──max turns reached────▶ turn_limit
//	any ─────reflection handed in──▶ completed   (SessionStore.Complete)

// TurnOutcome is what is known after a student turn.
type TurnOutcome struct {
	Turns          int  // student messages so far
	MaxTurns       int  // 0 means unlimited
	GoalsCompleted bool // the judge says every goal is met
	AutoEnd        bool // the assignment ends as soon as the goals are met
	// Identified: in the mystery game the student named the character and
	// the character confirmed it. The game is over whatever the goals say.
	Identified bool
}

// ReasonIdentified is why a mystery game ended when the character was found.
const ReasonIdentified = "identified"

// AppMystery is the guessing game whose end the judge may decide.
const AppMystery = "personaggio-misterioso"

// SessionState is the behaviour of a session status.
type SessionState interface {
	Status() string
	Ended() bool
	// Next returns the state after a turn and, when it changed, why
	// (the new status name, or ReasonIdentified).
	Next(o TurnOutcome) (next SessionState, reason string)
}

// StateOf returns the state of a stored status.
func StateOf(status string) SessionState {
	if status == SessionActive {
		return activeState{}
	}
	return endedState{status: status}
}

type activeState struct{}

func (activeState) Status() string { return SessionActive }
func (activeState) Ended() bool    { return false }

func (s activeState) Next(o TurnOutcome) (SessionState, string) {
	switch {
	case o.Identified:
		return endedState{status: SessionGoalReached}, ReasonIdentified
	case o.GoalsCompleted && o.AutoEnd:
		return endedState{status: SessionGoalReached}, SessionGoalReached
	case o.MaxTurns > 0 && o.Turns >= o.MaxTurns:
		return endedState{status: SessionTurnLimit}, SessionTurnLimit
	}
	return s, ""
}

// endedState covers goal_reached, turn_limit, completed and abandoned.
type endedState struct{ status string }

func (e endedState) Status() string                          { return e.status }
func (endedState) Ended() bool                               { return true }
func (e endedState) Next(TurnOutcome) (SessionState, string) { return e, "" }
