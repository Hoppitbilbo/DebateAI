package app

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"strconv"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"github.com/Hoppitbilbo/DebateAI/server/internal/store"
)

// OpenDB opens the database and applies the schema (see store.Open).
func OpenDB(path string) (*sql.DB, error) { return store.Open(path) }

func now() string { return domain.Now() }

func parseTime(s string) time.Time { return domain.ParseTime(s) }

func atoiDefault(s string, def int) int {
	if n, err := strconv.Atoi(s); err == nil {
		return n
	}
	return def
}

// ---------- secrets ----------

type Crypto struct{ aead cipher.AEAD }

func NewCrypto(secret string) *Crypto {
	key := sha256.Sum256([]byte("debateai:" + secret))
	block, _ := aes.NewCipher(key[:])
	aead, _ := cipher.NewGCM(block)
	return &Crypto{aead: aead}
}

func (c *Crypto) Encrypt(plain string) string {
	if plain == "" {
		return ""
	}
	nonce := make([]byte, c.aead.NonceSize())
	_, _ = rand.Read(nonce)
	return base64.StdEncoding.EncodeToString(c.aead.Seal(nonce, nonce, []byte(plain), nil))
}

func (c *Crypto) Decrypt(enc string) (string, error) {
	if enc == "" {
		return "", nil
	}
	raw, err := base64.StdEncoding.DecodeString(enc)
	if err != nil || len(raw) < c.aead.NonceSize() {
		return "", errors.New("invalid ciphertext")
	}
	out, err := c.aead.Open(nil, raw[:c.aead.NonceSize()], raw[c.aead.NonceSize():], nil)
	if err != nil {
		return "", errors.New("cannot decrypt secret (APP_SECRET changed?)")
	}
	return string(out), nil
}

func randomToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func hashToken(t string) string {
	h := sha256.Sum256([]byte(t))
	return hex.EncodeToString(h[:])
}

// logIfErr logs the failure of a best-effort step that must not fail the request.
func logIfErr(what string, err error) {
	if err != nil {
		log.Printf("%s: %v", what, err)
	}
}

func ptr[T any](v T) *T { return &v }

// valueOr returns *p, or def when p is nil.
func valueOr[T any](p *T, def T) T {
	if p == nil {
		return def
	}
	return *p
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
