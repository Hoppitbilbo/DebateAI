package httpapi

import (
	"net/http/httptest"
	"testing"
)

func TestClientIP(t *testing.T) {
	cases := []struct {
		name, trust, peer, xff, want string
	}{
		{"direct client cannot spoof", "", "203.0.113.9:5000", "1.2.3.4", "203.0.113.9"},
		{"proxy on localhost", "", "127.0.0.1:5000", "198.51.100.7", "198.51.100.7"},
		{"client-written prefix is ignored", "", "10.0.0.2:5000", "1.2.3.4, 198.51.100.7", "198.51.100.7"},
		{"chain of trusted proxies", "", "10.0.0.2:5000", "198.51.100.7, 10.0.0.3", "198.51.100.7"},
		{"trust all", "*", "203.0.113.9:5000", "198.51.100.7", "198.51.100.7"},
		{"trust none", "none", "127.0.0.1:5000", "198.51.100.7", "127.0.0.1"},
		{"explicit list", "203.0.113.0/24", "203.0.113.9:5000", "198.51.100.7", "198.51.100.7"},
		{"ipv6 peer", "", "[2001:db8::1]:5000", "1.2.3.4", "2001:db8::1"},
		{"no header", "", "127.0.0.1:5000", "", "127.0.0.1"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil)
			r.RemoteAddr = c.peer
			if c.xff != "" {
				r.Header.Set("X-Forwarded-For", c.xff)
			}
			if got := parseProxyTrust(c.trust).clientIP(r); got != c.want {
				t.Fatalf("clientIP = %q, want %q", got, c.want)
			}
		})
	}
}
