package httpapi

import "time"

// Limits of the HTTP API.

// List sizes of the admin and teacher pages.
const (
	maxListedUsers          = 500
	maxListedInvites        = 500
	maxListedTeacherInvites = 200
	maxListedSessions       = 100 // a student's own attempts
	maxUsageGroups          = 400 // rows per grouping in the cost report
)

// What is forwarded to the model per request: at most maxChatHistoryMessages
// messages and maxChatInputChars characters (system prompt included, about
// 50k tokens); the oldest messages are dropped first. A request whose system
// prompt and last message alone exceed it is refused.
const (
	maxChatHistoryMessages = 200
	maxChatInputChars      = 200_000
)

// The tasks that still take a prompt written by the caller (investigation
// 11/11, C5, first step): teacher helpers and voice casting ("utility"),
// and the evaluation of an attempt without an account. Room for the real
// callers (a Wikipedia summary and a list of titles, a whole guest
// conversation), not for a free chatbot.
const (
	maxUtilityInputChars        = 12_000
	maxUtilityOutputTokens      = 4096
	maxAnonymousEvaluationChars = 60_000
)

// evaluationDeadline bounds a final evaluation, which goes on after the
// browser disconnects so that the hand-in is stored.
const evaluationDeadline = 3 * time.Minute

// Answers generated at the same time: per account (a guest too), per room
// and, without an account, per network (a school lab shares one IP).
const (
	maxGenerationsPerUser    = 3
	maxGenerationsPerRoom    = 40
	maxGenerationsPerNetwork = 30
)

// Bounds of what the browser may ask of /api/ai/generate. The output ceiling
// only clamps an explicit request (the evaluation asks for 2500): no default
// is imposed, since reasoning models count their thinking in max_tokens.
const (
	maxGenerateBodyBytes    = 1 << 20
	maxGenerateOutputTokens = 8192
)

// defaultBodyBytes bounds a JSON request body without a limit of its own.
const defaultBodyBytes = 8 << 20

// maxSessionBodyBytes bounds starting an attempt and saving its transcript;
// the service bounds the content further (app/limits.go).
const maxSessionBodyBytes = 1 << 20

// Rate limits.
const (
	forgotRequestsLimit = 5  // per hour and IP
	joinAttemptsLimit   = 20 // per hour and user
	liveTokensLimit     = 30 // per hour, IP and login state

	rateLimiterSweepEvery = 10 * time.Minute
)

// Temporary rooms. A school lab shares one IP, so only failures are
// counted per network, with room for a class of students mistyping.
const (
	anonymousRoomsPerIPDay = 30
	roomPurgeEvery         = 5 * time.Minute // long-running servers; Vercel uses its cron
)
