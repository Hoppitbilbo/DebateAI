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

// maxChatHistoryMessages is how many messages are forwarded to the model per request.
const maxChatHistoryMessages = 200

// Rate limits.
const (
	loginAttemptsLimit  = 20
	loginAttemptsWindow = 15 * time.Minute
	forgotRequestsLimit = 5  // per hour and IP
	joinAttemptsLimit   = 20 // per hour and user
	liveTokensLimit     = 30 // per hour, IP and login state

	rateLimiterSweepEvery = 10 * time.Minute
)
