// Package domain holds the entities shared by the repositories (store) and
// the application (app). It has no dependencies on either.
package domain

import (
	"errors"
	"time"
)

// ErrEmailTaken is returned when an e-mail address is already registered.
var ErrEmailTaken = errors.New("email already registered")

// Now is the timestamp format stored in the database (RFC 3339, UTC).
func Now() string { return time.Now().UTC().Format(time.RFC3339) }

// ParseTime reads a stored timestamp; invalid values give the zero time.
func ParseTime(s string) time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	return t
}
