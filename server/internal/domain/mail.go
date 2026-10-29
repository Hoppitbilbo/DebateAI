package domain

// OutboxMail is an e-mail waiting in the outbox.
type OutboxMail struct {
	ID                int64
	To, Subject, Body string
	Attempts          int
}
