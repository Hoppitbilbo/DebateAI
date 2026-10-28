package httpapi

import (
	"net/http"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/xuri/excelize/v2"
)

// Results of a temporary room as an Excel workbook: one row per attempt.

var roomHeaders = map[string][]string{
	"it": {"Nickname", "Attività", "Stato", "Turni", "Progresso %", "Voto conversazione (IA)", "Voto riflessione (IA)", "Riflessione", "Iniziata", "Ultimo aggiornamento"},
	"en": {"Nickname", "Activity", "Status", "Turns", "Progress %", "Conversation score (AI)", "Reflection score (AI)", "Reflection", "Started", "Last update"},
	"es": {"Apodo", "Actividad", "Estado", "Turnos", "Progreso %", "Nota conversación (IA)", "Nota reflexión (IA)", "Reflexión", "Iniciada", "Última actualización"},
	"fr": {"Pseudo", "Activité", "Statut", "Tours", "Progression %", "Note conversation (IA)", "Note réflexion (IA)", "Réflexion", "Commencée", "Dernière mise à jour"},
	"de": {"Spitzname", "Aktivität", "Status", "Runden", "Fortschritt %", "Note Gespräch (KI)", "Note Reflexion (KI)", "Reflexion", "Begonnen", "Letzte Änderung"},
}

func writeRoomXLSX(w http.ResponseWriter, e *app.RoomExport, locale string) {
	locale = app.NormLocale(locale)
	f := excelize.NewFile()
	defer f.Close()
	const sheet = "Sheet1"
	headers := roomHeaders[locale]
	head := make([]any, len(headers))
	for i, h := range headers {
		head[i] = h
	}
	_ = f.SetSheetRow(sheet, "A1", &head)
	optional := func(v *int) any {
		if v == nil {
			return ""
		}
		return *v
	}
	row := 2
	for _, g := range e.Guests {
		if len(g.Sessions) == 0 {
			cell, _ := excelize.CoordinatesToCellName(1, row)
			_ = f.SetSheetRow(sheet, cell, &[]any{g.Nickname, "", gradeStatuses[locale]["todo"]})
			row++
			continue
		}
		for _, s := range g.Sessions {
			title := s.Title
			if title == "" {
				title = s.AppType
			}
			cell, _ := excelize.CoordinatesToCellName(1, row)
			_ = f.SetSheetRow(sheet, cell, &[]any{g.Nickname, title, gradeStatuses[locale][s.Status], s.Turns, s.Progress,
				optional(s.ScoreConversation), optional(s.ScoreReflection), s.Reflection, s.StartedAt, s.UpdatedAt})
			row++
		}
	}
	bold, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}})
	last, _ := excelize.ColumnNumberToName(len(headers))
	_ = f.SetCellStyle(sheet, "A1", last+"1", bold)
	_ = f.SetColWidth(sheet, "A", last, 18)
	_ = f.SetPanes(sheet, &excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft"})
	sendXLSX(w, f, "room.xlsx", safeFileName(e.Title+" "+e.CreatedAt[:10])+".xlsx")
}
