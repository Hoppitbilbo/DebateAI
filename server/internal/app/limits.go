package app

import "time"

// Limits and timeouts of the server in one place, so their meaning is named
// and changing one does not mean hunting for a literal.

// Activity sessions and assignments.
const (
	maxSessionTitleChars  = 200
	maxTranscriptMessages = 1000 // older messages are dropped when saving
	maxReflectionChars    = 20000
	maxEvaluationChars    = 40000
)

// JEV judge.
const (
	judgeRequestTimeout  = 90 * time.Second // whole judgement, all targets
	judgeTargetTimeout   = 60 * time.Second // one provider/model attempt
	maxJudgeContextChars = 2000             // activity setup sent with the state
	// defaultJudgeThreshold is the goal score that counts as "met" when the
	// configured threshold is missing or out of (0, 1).
	defaultJudgeThreshold = 0.7
	// offTopicThreshold flags off-topic or manipulative student messages.
	offTopicThreshold = 0.8
)

// AI gateway and providers.
const (
	modelListTimeout    = 20 * time.Second
	modelRefreshTimeout = 30 * time.Second
	providerTestTimeout = 60 * time.Second
	liveTokenTimeout    = 20 * time.Second
)

// Authentication and invites.
const (
	resetLinkTTL = 2 * time.Hour
	inviteTTL    = 14 * 24 * time.Hour
)

// Temporary rooms ("aula lampo").
const (
	defaultRoomMinutes   = 60
	rejoinPINTTL         = 10 * time.Minute
	rejoinPINDigits      = 4
	maxRoomTitleChars    = 120
	maxRoomInstructChars = 4000
	roomAttemptsPerGuest = 200 // attempts of one guest included in an export
)

// smtpDialTimeout bounds the connection to the mail server.
const smtpDialTimeout = 15 * time.Second
