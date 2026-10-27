package app

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Port         string
	DataDir      string
	DatabasePath string
	// DatabaseURL selects a remote libSQL database (Turso) instead of the
	// SQLite file in DataDir; DatabaseToken is its auth token.
	DatabaseURL   string
	DatabaseToken string
	Secret        string
	PublicURL     string
	StaticDir     string
	AdminEmail    string
	AdminPassword string
	AdminName     string
	GeminiAPIKey  string
	OpencodeKey   string
	OpenRouterKey string
	TypeSafeKey   string
	SMTP          SMTPSettings
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func LoadConfig() Config {
	c := Config{
		Port:          env("PORT", "8080"),
		DataDir:       env("DATA_DIR", "./data"),
		PublicURL:     strings.TrimRight(env("PUBLIC_URL", ""), "/"),
		StaticDir:     env("STATIC_DIR", ""),
		AdminEmail:    env("ADMIN_EMAIL", ""),
		AdminPassword: env("ADMIN_PASSWORD", ""),
		AdminName:     env("ADMIN_NAME", "Admin"),
		GeminiAPIKey:  env("GEMINI_API_KEY", env("VITE_GEMINI_API_KEY", "")),
		OpencodeKey:   env("OPENCODE_API_KEY", ""),
		OpenRouterKey: env("OPENROUTER_API_KEY", ""),
		TypeSafeKey:   env("TYPESAFE_API_KEY", ""),
		SMTP: SMTPSettings{
			Host:     env("SMTP_HOST", ""),
			Port:     atoiDefault(env("SMTP_PORT", "587"), 587),
			Username: env("SMTP_USERNAME", ""),
			Password: env("SMTP_PASSWORD", ""),
			From:     env("SMTP_FROM", ""),
			Security: env("SMTP_SECURITY", "starttls"),
		},
	}
	c.DatabaseURL = env("TURSO_DATABASE_URL", "")
	c.DatabaseToken = env("TURSO_AUTH_TOKEN", "")
	c.Secret = env("APP_SECRET", "")
	if c.DatabaseURL != "" {
		// Nothing is kept on disk: the host may have none (Vercel). A secret
		// generated here would be lost, and with it every stored API key.
		if c.Secret == "" {
			log.Fatal("APP_SECRET is required with TURSO_DATABASE_URL")
		}
		return c
	}
	if err := os.MkdirAll(c.DataDir, 0o750); err != nil {
		log.Fatalf("cannot create data dir %s: %v", c.DataDir, err)
	}
	c.DatabasePath = env("DATABASE_PATH", filepath.Join(c.DataDir, "debateai.db"))
	if c.Secret == "" {
		c.Secret = loadOrCreateSecret(filepath.Join(c.DataDir, "secret.key"))
	}
	return c
}

// Storage describes where the data lives, for the startup log (never the token).
func (c Config) Storage() string {
	if c.DatabaseURL != "" {
		return "remote libSQL"
	}
	return c.DatabasePath
}

// loadOrCreateSecret keeps a random secret in the data dir so encrypted API
// keys survive restarts even when APP_SECRET is not configured.
func loadOrCreateSecret(path string) string {
	if b, err := os.ReadFile(path); err == nil && len(strings.TrimSpace(string(b))) >= 32 {
		return strings.TrimSpace(string(b))
	}
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		log.Fatal(err)
	}
	s := hex.EncodeToString(buf)
	if err := os.WriteFile(path, []byte(s), 0o600); err != nil {
		log.Fatalf("cannot write secret file: %v", err)
	}
	log.Printf("generated new APP_SECRET in %s (back it up together with the database)", path)
	return s
}
