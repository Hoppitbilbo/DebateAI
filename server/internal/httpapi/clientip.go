package httpapi

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// proxyTrust decides whose forwarding headers count when finding the client
// address for rate limits. A client that reaches the Go port directly could
// otherwise pick any X-Forwarded-For and dodge every per-IP limit.
type proxyTrust struct {
	all      bool
	prefixes []netip.Prefix
}

// defaultTrustedProxies covers a reverse proxy on the same host or on a
// private (Docker, LAN) network.
var defaultTrustedProxies = []string{"127.0.0.0/8", "::1/128", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7"}

// parseProxyTrust reads TRUSTED_PROXIES: "*" trusts every peer (a platform
// such as Vercel, where the app is never reachable directly), "none" trusts
// nobody, otherwise a comma-separated list of CIDRs or addresses. Empty means
// the private-network defaults.
func parseProxyTrust(spec string) proxyTrust {
	spec = strings.TrimSpace(spec)
	switch spec {
	case "*":
		return proxyTrust{all: true}
	case "none":
		return proxyTrust{}
	case "":
		spec = strings.Join(defaultTrustedProxies, ",")
	}
	var t proxyTrust
	for _, part := range strings.Split(spec, ",") {
		part = strings.TrimSpace(part)
		if p, err := netip.ParsePrefix(part); err == nil {
			t.prefixes = append(t.prefixes, p.Masked())
		} else if a, err := netip.ParseAddr(part); err == nil {
			t.prefixes = append(t.prefixes, netip.PrefixFrom(a.Unmap(), a.Unmap().BitLen()))
		}
	}
	return t
}

func (t proxyTrust) trusts(ip string) bool {
	if t.all {
		return true
	}
	a, err := netip.ParseAddr(ip)
	if err != nil {
		return false
	}
	a = a.Unmap()
	for _, p := range t.prefixes {
		if p.Contains(a) {
			return true
		}
	}
	return false
}

// clientIP is the connecting peer, unless that peer is a trusted proxy: then
// it is the right-most X-Forwarded-For entry that is not itself a trusted
// proxy (entries further left were written by the client and prove nothing).
func (t proxyTrust) clientIP(r *http.Request) string {
	peer := r.RemoteAddr
	if host, _, err := net.SplitHostPort(peer); err == nil {
		peer = host
	}
	if !t.trusts(peer) {
		return peer
	}
	if f := r.Header.Get("X-Forwarded-For"); f != "" {
		hops := strings.Split(f, ",")
		for i := len(hops) - 1; i >= 0; i-- {
			hop := strings.TrimSpace(hops[i])
			if hop == "" {
				continue
			}
			if i == 0 || !t.trusts(hop) {
				return hop
			}
		}
	}
	if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); ip != "" {
		return ip
	}
	return peer
}
