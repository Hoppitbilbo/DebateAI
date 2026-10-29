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

// Recipes of the characters' prompts (prompts.go). Longer bios are cut
// like the browser cuts them; the other limits refuse the recipe.
const (
	maxRecipeTitleChars   = 200
	maxRecipeTopicChars   = 500
	maxRecipeBioChars     = 4000 // UTF-16 code units, as in the browser
	maxRecipeQuestions    = 20
	impersonaUserBioChars = 600 // part of the student's character bio in impersona-tu
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
	// identifiedThreshold: the judge is sure the mystery character was found.
	identifiedThreshold = 0.8
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
	// liveReservedTokens is the input and the output reserved for a voice
	// conversation on a paid model until its usage is reported: about a
	// quarter of an hour of audio each way (25 tokens per second).
	liveReservedTokens = 25 * 15 * 60
)

// Fallback chain (gateway.go, target_health.go).
const (
	// firstTextBudget bounds the wait for the first text of a streamed
	// answer across all the targets tried, so slow fallbacks do not add up.
	firstTextBudget = 45 * time.Second
	// generateDeadline bounds a whole non-streamed generation, fallbacks included.
	generateDeadline = 150 * time.Second
	// A target that failed failuresBeforeCooldown times in a row is tried
	// after the others for targetCooldown.
	failuresBeforeCooldown = 3
	targetCooldown         = 2 * time.Minute
)

// settingsCacheTTL bounds how long a settings change made by another
// instance takes to be seen (settings_cache.go).
const settingsCacheTTL = 5 * time.Second

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

// Mail: smtpDialTimeout bounds the connection to the mail server,
// smtpExchangeTimeout the whole conversation with it.
const (
	smtpDialTimeout     = 15 * time.Second
	smtpExchangeTimeout = 60 * time.Second
)

// Mail outbox (outbox.go): mails claimed per batch, how long a claimed mail
// waits before it is due again if the process stopped, how often retries
// are looked for.
const (
	outboxBatch = 20
	outboxLease = 5 * time.Minute
	outboxPoll  = time.Minute
)
