package store

import (
	"strings"
	"testing"
)

// The frequent lookups are answered from an index, without scanning the
// table or sorting in a temporary tree (audit #10).
func TestFrequentQueriesUseIndexes(t *testing.T) {
	db := openTestDB(t)
	for _, q := range []string{
		`SELECT * FROM assignments WHERE class_id = 1`,
		`SELECT * FROM activity_sessions s WHERE s.user_id = 1 AND s.assignment_id = 2 ORDER BY s.started_at DESC LIMIT 1`,
		`SELECT SUM(cost_usd) FROM usage_log WHERE user_id = 1 AND created_at >= '2026'`,
		`SELECT class_id FROM class_members WHERE user_id = 1`,
		`DELETE FROM auth_sessions WHERE expires_at < '2026'`,
	} {
		rows, err := db.Query(`EXPLAIN QUERY PLAN ` + q)
		if err != nil {
			t.Fatal(err)
		}
		for rows.Next() {
			var id, parent, unused int
			var detail string
			if err := rows.Scan(&id, &parent, &unused, &detail); err != nil {
				t.Fatal(err)
			}
			if strings.HasPrefix(detail, "SCAN") || strings.Contains(detail, "TEMP B-TREE") {
				t.Errorf("%s: %s", q, detail)
			}
		}
		rows.Close()
	}
}
