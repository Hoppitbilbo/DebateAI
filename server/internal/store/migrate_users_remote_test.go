package store

import (
	"database/sql"
	"errors"
	"os"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"

	"github.com/tursodatabase/libsql-client-go/libsql"
)

// The users rebuild on a libSQL server, as on Turso. It needs an empty
// server: docker run --rm -p 8089:8080 ghcr.io/tursodatabase/libsql-server
// and LIBSQL_TEST_URL=http://127.0.0.1:8089.
func TestRemoteMakesEmailOptional(t *testing.T) {
	url := os.Getenv("LIBSQL_TEST_URL")
	if url == "" {
		t.Skip("LIBSQL_TEST_URL not set")
	}
	connector, err := libsql.NewConnector(url)
	if err != nil {
		t.Fatal(err)
	}
	raw := sql.OpenDB(connector)
	defer raw.Close()
	fillOldDatabase(t, raw)

	db, err := OpenRemote(url, "")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	checkMigratedUsers(t, db)
	// A link is used once on libSQL too (user 5 is created by the check).
	resets := NewPasswordResets(db)
	if err := resets.Issue(domain.NewPasswordReset{TokenHash: "new", UserID: 5, ExpiresAt: inOneHour()}); err != nil {
		t.Fatal(err)
	}
	if uid, err := resets.Consume("new", "h"); err != nil || uid != 5 {
		t.Fatalf("consume on libSQL: %d %v", uid, err)
	}
	if _, err := resets.Consume("new", "x"); !errors.Is(err, domain.ErrResetLinkInvalid) {
		t.Fatalf("reuse on libSQL: %v", err)
	}
	if db, err = OpenRemote(url, ""); err != nil {
		t.Fatal(err)
	}
	db.Close()
}
