package httpapi

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"github.com/xuri/excelize/v2"
)

func TestRoomXLSXHasOneRowPerAttempt(t *testing.T) {
	score := 8
	e := &app.RoomExport{Title: "Napoleone", CreatedAt: "2026-10-28T09:00:00Z", Guests: []app.ExportedGuest{
		{Nickname: "Marco R", Sessions: []domain.SessionDetail{
			{SessionSummary: domain.SessionSummary{Title: "Russia", Status: domain.SessionCompleted, Turns: 4, Progress: 100, ScoreConversation: &score}, Reflection: "Ho capito"},
			{SessionSummary: domain.SessionSummary{AppType: "wiki-chatbot", Status: domain.SessionActive, Turns: 1}},
		}},
		{Nickname: "Anna"},
	}}
	rec := httptest.NewRecorder()
	writeRoomXLSX(rec, e, "it")

	if got := rec.Header().Get("Content-Disposition"); !strings.Contains(got, "Napoleone%202026-10-28.xlsx") {
		t.Fatalf("file name: %q", got)
	}
	f, err := excelize.OpenReader(rec.Body)
	if err != nil {
		t.Fatal(err)
	}
	rows, _ := f.GetRows("Sheet1")
	if len(rows) != 4 || rows[0][0] != "Nickname" {
		t.Fatalf("rows: %v", rows)
	}
	if r := rows[1]; r[0] != "Marco R" || r[1] != "Russia" || r[2] != "Completata" || r[5] != "8" || r[7] != "Ho capito" {
		t.Fatalf("attempt row: %v", r)
	}
	if r := rows[2]; r[1] != "wiki-chatbot" || r[2] != "In corso" {
		t.Fatalf("untitled attempt row: %v", r)
	}
	if r := rows[3]; r[0] != "Anna" || r[2] != "Da iniziare" {
		t.Fatalf("guest without attempts: %v", r)
	}
}
