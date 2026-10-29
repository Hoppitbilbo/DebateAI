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
	// liveGrantTTL is how long after the token the browser may report a
	// voice conversation's usage; it also bounds the reported duration.
	liveGrantTTL = time.Hour
)

// Admission and budget reservations (admission.go).
const (
	// inflightTTL bounds how long a generation slot or a budget reservation
	// survives a process that died before releasing it.
	inflightTTL = 10 * time.Minute
	// reservedOutputTokens is the output reserved for a call that sets no
	// max_tokens.
	reservedOutputTokens = 4096
	// reserveCharsPerToken is a cautious (low) characters-per-token ratio
	// for the reservation; estimatedCharsPerToken is the usual one, used to
	// estimate the usage of a call the provider did not report.
	reserveCharsPerToken   = 3
	estimatedCharsPerToken = 4
)

// unpricedReserve is the price per million tokens reserved for a paid
// model without a known price, at the high end of current models.
var unpricedReserve = price{In: 15, Out: 75, Known: true}

// Authentication and invites.
const (
	resetLinkTTL = 2 * time.Hour
	inviteTTL    = 14 * 24 * time.Hour
)

// Temporary rooms ("aula lampo").
const (
	defaultRoomMinutes   = 60
	roomHostKeyBytes     = 24 // entropy of the secret link that manages a room
	rejoinPINTTL         = 10 * time.Minute
	rejoinPINDigits      = 4
	maxRoomTitleChars    = 120
	maxRoomInstructChars = 4000
	roomAttemptsPerGuest = 200 // attempts of one guest included in an export
	roomPurgeInterval    = time.Minute
)

// smtpDialTimeout bounds the connection to the mail server.
const smtpDialTimeout = 15 * time.Second
