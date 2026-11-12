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
		// Investigation 11/11, E3.
		`SELECT COUNT(*) FROM live_grants WHERE session_id = 1`,
		`UPDATE activity_sessions SET class_id = NULL WHERE class_id = 1`,
		`SELECT * FROM invites i WHERE i.kind = 'invite' AND i.class_id = 1 AND i.accepted_at IS NULL`,
		`SELECT * FROM invites i WHERE i.kind = 'invite' AND i.invited_by = 1 ORDER BY i.created_at DESC LIMIT 10`,
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

// The month's spending, summed before every paid call, reads only the index
// (investigation 11/11, E3).
func TestMonthSpendingReadsOnlyTheIndex(t *testing.T) {
	db := openTestDB(t)
	rows, err := db.Query(`EXPLAIN QUERY PLAN SELECT SUM(cost_usd) FROM usage_log WHERE created_at >= '2026'`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	covered := false
	for rows.Next() {
		var id, parent, unused int
		var detail string
		if err := rows.Scan(&id, &parent, &unused, &detail); err != nil {
			t.Fatal(err)
		}
		covered = covered || strings.Contains(detail, "COVERING INDEX")
	}
	if !covered {
		t.Fatal("the month sum must be answered from a covering index")
	}
}
