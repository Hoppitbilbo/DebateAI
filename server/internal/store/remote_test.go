package store

import (
	"errors"
	"os"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// The schema on a libSQL server, as on Turso. It needs an empty server:
// docker run --rm -p 8089:8080 ghcr.io/tursodatabase/libsql-server
// and LIBSQL_TEST_URL=http://127.0.0.1:8089.
func TestRemoteSchema(t *testing.T) {
	url := os.Getenv("LIBSQL_TEST_URL")
	if url == "" {
		t.Skip("LIBSQL_TEST_URL not set")
	}
	db, err := OpenRemote(url, "")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	users, classes := NewUsers(db), NewClasses(db)
	teacher, err := users.Create("prof@x.it", "Prof", "", domain.RoleTeacher, "it")
	if err != nil {
		t.Fatal(err)
	}
	id, _ := classes.Create("3A", "", teacher, domain.EnrollUsername)
	c, _ := classes.Get(id)
	uid, _, err := users.CreateStudentInClass(domain.NewClassStudent{Code: c.JoinCode, Username: "luca", Name: "luca", PasswordHash: "h", Locale: "it"})
	if err != nil {
		t.Fatal(err)
	}
	// A link is used once on libSQL too.
	resets := NewPasswordResets(db)
	if err := resets.Issue(domain.NewPasswordReset{TokenHash: "remote", UserID: uid, ExpiresAt: inOneHour()}); err != nil {
		t.Fatal(err)
	}
	if got, err := resets.Consume("remote", "h2"); err != nil || got != uid {
		t.Fatalf("consume on libSQL: %d %v", got, err)
	}
	if _, err := resets.Consume("remote", "x"); !errors.Is(err, domain.ErrResetLinkInvalid) {
		t.Fatalf("reuse on libSQL: %v", err)
	}
	// Opening again finds the schema in place.
	if db, err = OpenRemote(url, ""); err != nil {
		t.Fatal(err)
	}
	db.Close()
}
