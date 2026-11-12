package app

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/netip"
	"strings"
	"time"
)

// Errors of authLimits; handlers answer 429 and 503.
var (
	ErrRateLimited       = errors.New("too many attempts, retry later")
	ErrLimitsUnavailable = errors.New("rate limits unavailable")
)

// rateLimitStore counts attempts per key and window in one atomic step,
// shared by every instance of the server (store.AuthRateLimits).
type rateLimitStore interface {
	Hit(key string, limit int, window time.Duration) (bool, error)
	Refund(key string) error
}

// authLimits throttles logins and enrollments with counters persisted in
// the database. A school lab shares one IP, so logins are counted per IP
// and identifier first; per identifier and per network caps stop guessing
// across many networks or many accounts. Keys are HMACs: no e-mail,
// username, IP or link is stored in clear. When the counters cannot be
// read the attempt is refused, never let through.
type authLimits struct {
	store  rateLimitStore
	secret []byte
}

func newAuthLimits(store rateLimitStore, secret string) *authLimits {
	return &authLimits{store: store, secret: []byte("auth-limits:" + secret)}
}

// Login counts a login attempt from ip for identifier (e-mail or username).
// The most specific counter comes first, so a student retrying a locked
// identifier does not use up the attempts of the whole network.
func (l *authLimits) Login(ip, identifier string) error {
	id := strings.ToLower(strings.TrimSpace(identifier))
	return l.hitAll(
		limitCheck{"login-ip-id", ip + "\x00" + id, loginAttemptsPerIdentifierIP, loginAttemptsWindow},
		limitCheck{"login-id", id, loginAttemptsPerIdentifier, loginAttemptsWindow},
		limitCheck{"login-net", networkOf(ip), loginAttemptsPerNetwork, loginAttemptsWindow},
	)
}

// ClassEnrollment counts an account creation attempt through a class link.
func (l *authLimits) ClassEnrollment(code string) error {
	return l.hitAll(limitCheck{"enroll-link", code, enrollmentsPerLink, enrollmentsWindow})
}

// RoomCode counts a room code typed from ip, before it is checked; the
// returned refund gives the attempt back when the code was right, so only
// wrong codes use up the limit. A school lab shares one IP, which is why
// right codes are not counted.
func (l *authLimits) RoomCode(ip string) (refund func(), err error) {
	return l.guess(limitCheck{"room-code", ip, wrongRoomCodesLimit, wrongRoomCodesWindow})
}

// RejoinPIN counts a PIN typed for a room and nickname, whatever the
// network (PINs have four digits), before it is compared; refund when it
// was right.
func (l *authLimits) RejoinPIN(code, nickname string) (refund func(), err error) {
	return l.guess(limitCheck{"room-pin", code + "\x00" + nickname, wrongPINsLimit, wrongPINsWindow})
}

// guess counts an attempt before the caller checks it, so a burst of
// parallel requests cannot all pass a limit that only failures should use.
func (l *authLimits) guess(c limitCheck) (func(), error) {
	if err := l.hitAll(c); err != nil {
		return nil, err
	}
	key := l.key(c.kind, c.subject)
	return func() {
		if err := l.store.Refund(key); err != nil {
			log.Printf("auth rate limit %s refund: %v", c.kind, err)
		}
	}, nil
}

type limitCheck struct {
	kind, subject string
	limit         int
	window        time.Duration
}

func (l *authLimits) hitAll(checks ...limitCheck) error {
	for _, c := range checks {
		ok, err := l.store.Hit(l.key(c.kind, c.subject), c.limit, c.window)
		if err != nil {
			log.Printf("auth rate limit %s: %v", c.kind, err)
			return fmt.Errorf("%w: %v", ErrLimitsUnavailable, err)
		}
		if !ok {
			return ErrRateLimited
		}
	}
	return nil
}

func (l *authLimits) key(kind, subject string) string {
	m := hmac.New(sha256.New, l.secret)
	m.Write([]byte(kind + "\x00" + subject))
	return kind + ":" + hex.EncodeToString(m.Sum(nil))
}

// networkOf is the network an address belongs to for the per-network cap:
// the address itself for IPv4, its /64 for IPv6 (one home or school line).
func networkOf(ip string) string {
	a, err := netip.ParseAddr(ip)
	if err != nil {
		return ip
	}
	a = a.Unmap()
	if a.Is4() {
		return a.String()
	}
	p, _ := a.Prefix(64)
	return p.String()
}
