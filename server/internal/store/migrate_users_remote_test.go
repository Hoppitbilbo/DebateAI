package store

import (
	"database/sql"
	"os"
	"testing"

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
	if db, err = OpenRemote(url, ""); err != nil {
		t.Fatal(err)
	}
	db.Close()
}
