package httpapi

import (
	"net/http"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
)

// Results of a temporary room as an Excel workbook: one row per attempt,
// one empty row for a guest who did not start.

var roomHeaders = map[string][]string{
	"it": {"Nickname", "Attività", "Stato", "Turni", "Progresso %", "Voto conversazione (IA)", "Voto riflessione (IA)", "Riflessione", "Iniziata", "Ultimo aggiornamento"},
	"en": {"Nickname", "Activity", "Status", "Turns", "Progress %", "Conversation score (AI)", "Reflection score (AI)", "Reflection", "Started", "Last update"},
	"es": {"Apodo", "Actividad", "Estado", "Turnos", "Progreso %", "Nota conversación (IA)", "Nota reflexión (IA)", "Reflexión", "Iniciada", "Última actualización"},
	"fr": {"Pseudo", "Activité", "Statut", "Tours", "Progression %", "Note conversation (IA)", "Note réflexion (IA)", "Réflexion", "Commencée", "Dernière mise à jour"},
	"de": {"Spitzname", "Aktivität", "Status", "Runden", "Fortschritt %", "Note Gespräch (KI)", "Note Reflexion (KI)", "Reflexion", "Begonnen", "Letzte Änderung"},
}

func writeRoomXLSX(w http.ResponseWriter, e *app.RoomExport, locale string) {
	locale = app.NormLocale(locale)
	sheet := newResultSheet(roomHeaders[locale])
	defer sheet.Close()
	for _, g := range e.Guests {
		if len(g.Sessions) == 0 {
			sheet.addRow(g.Nickname, "", gradeStatuses[locale]["todo"])
		}
		for _, s := range g.Sessions {
			title := s.Title
			if title == "" {
				title = s.AppType
			}
			sheet.addRow(g.Nickname, title, gradeStatuses[locale][s.Status], s.Turns, s.Progress,
				optionalInt(s.ScoreConversation), optionalInt(s.ScoreReflection), s.Reflection, s.StartedAt, s.UpdatedAt)
		}
	}
	sheet.send(w, "room.xlsx", safeFileName(e.Title+" "+fileDay(e.CreatedAt))+".xlsx")
}
