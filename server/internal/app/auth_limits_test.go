package app

import (
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"
)

// countingLimits is an in-memory rateLimitStore that remembers the keys.
type countingLimits struct {
	counts map[string]int
	keys   []string
	err    error
}

func (c *countingLimits) Hit(key string, limit int, _ time.Duration) (bool, error) {
	if c.err != nil {
		return false, c.err
	}
	if c.counts == nil {
		c.counts = map[string]int{}
	}
	c.keys = append(c.keys, key)
	if c.counts[key] >= limit {
		return false, nil
	}
	c.counts[key]++
	return true, nil
}

func TestLoginLimitIsPerIdentifierOnTheSameNetwork(t *testing.T) {
	l := &authLimits{store: &countingLimits{}, secret: []byte("s")}
	for i := 0; i < loginAttemptsPerIdentifierIP; i++ {
		if err := l.Login("10.0.0.1", "Anna"); err != nil {
			t.Fatalf("attempt %d: %v", i, err)
		}
	}
	if err := l.Login("10.0.0.1", " anna "); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("same identifier, normalized: %v", err)
	}
	if err := l.Login("10.0.0.1", "marco"); err != nil {
		t.Fatalf("another student on the same network: %v", err)
	}
}

func TestLoginLimitPerIdentifierAcrossNetworks(t *testing.T) {
	l := &authLimits{store: &countingLimits{}, secret: []byte("s")}
	for i := 0; i < loginAttemptsPerIdentifier; i++ {
		_ = l.Login(fmt.Sprintf("10.0.%d.%d", i/200, i%200), "anna")
	}
	if err := l.Login("192.168.1.1", "anna"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("identifier tried from many networks: %v", err)
	}
}

func TestLoginLimitPerNetwork(t *testing.T) {
	l := &authLimits{store: &countingLimits{}, secret: []byte("s")}
	for i := 0; i < loginAttemptsPerNetwork; i++ {
		if err := l.Login("10.0.0.1", fmt.Sprint("user", i)); err != nil {
			t.Fatalf("attempt %d: %v", i, err)
		}
	}
	if err := l.Login("10.0.0.1", "another"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("network cap: %v", err)
	}
}

func TestIPv6NetworkIsTheSlash64(t *testing.T) {
	if networkOf("2001:db8:1:2:aaaa::1") != networkOf("2001:db8:1:2:bbbb::9") {
		t.Fatal("addresses of one /64 are one network")
	}
	if networkOf("2001:db8:1:3::1") == networkOf("2001:db8:1:2::1") {
		t.Fatal("different /64 are different networks")
	}
	if networkOf("10.0.0.1") == networkOf("10.0.0.2") {
		t.Fatal("IPv4 addresses are distinct networks")
	}
}

func TestLimitKeysAreHashed(t *testing.T) {
	c := &countingLimits{}
	l := &authLimits{store: c, secret: []byte("s")}
	_ = l.Login("10.0.0.1", "anna@example.com")
	_ = l.ClassEnrollment("ABCDEF")
	for _, k := range c.keys {
		for _, clear := range []string{"10.0.0.1", "anna", "example", "ABCDEF"} {
			if contains(k, clear) {
				t.Fatalf("key %q holds %q in clear", k, clear)
			}
		}
	}
}

func TestLimitsFailClosed(t *testing.T) {
	l := &authLimits{store: &countingLimits{err: errors.New("db down")}, secret: []byte("s")}
	if err := l.Login("10.0.0.1", "anna"); err == nil || errors.Is(err, ErrRateLimited) {
		t.Fatalf("an unavailable store must refuse, not limit: %v", err)
	}
	if !errors.Is(l.Login("10.0.0.1", "anna"), ErrLimitsUnavailable) {
		t.Fatal("want ErrLimitsUnavailable")
	}
	if !errors.Is(l.ClassEnrollment("X"), ErrLimitsUnavailable) {
		t.Fatal("enrollment: want ErrLimitsUnavailable")
	}
}

func TestClassEnrollmentLimitPerLink(t *testing.T) {
	l := &authLimits{store: &countingLimits{}, secret: []byte("s")}
	for i := 0; i < enrollmentsPerLink; i++ {
		if err := l.ClassEnrollment("CODE"); err != nil {
			t.Fatal(err)
		}
	}
	if !errors.Is(l.ClassEnrollment("CODE"), ErrRateLimited) {
		t.Fatal("link cap")
	}
	if l.ClassEnrollment("OTHER") != nil {
		t.Fatal("links are independent")
	}
}

func contains(s, sub string) bool { return strings.Contains(strings.ToLower(s), strings.ToLower(sub)) }
