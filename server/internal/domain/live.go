package domain

// LiveGrant is a voice conversation the server allowed: the audio goes
// straight from the browser to the provider, so the usage the browser reports
// at the end is accepted only against an unused grant, and with the
// provider, model and attempt the server chose.
type LiveGrant struct {
	ID         string
	UserID     *int64 // nil for an anonymous visitor
	SessionID  *int64
	ProviderID int64
	Model      string
	CreatedAt  string
	ExpiresAt  string
	// ReservationID is the budget reserved for it until the usage is
	// reported (0: none, e.g. a free model).
	ReservationID int64
}
