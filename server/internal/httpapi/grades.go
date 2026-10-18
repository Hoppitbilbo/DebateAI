package httpapi

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"github.com/xuri/excelize/v2"
)

// Grade export as an Excel workbook (one row per student and assignment).

var gradeHeaders = map[string][]string{
	"it": {"Studente", "Email", "Compito", "Stato", "Progresso %", "Voto conversazione (IA)", "Voto riflessione (IA)", "Voto docente", "Tentativi", "Ultimo aggiornamento"},
	"en": {"Student", "Email", "Assignment", "Status", "Progress %", "Conversation score (AI)", "Reflection score (AI)", "Teacher score", "Attempts", "Last update"},
	"es": {"Estudiante", "Email", "Tarea", "Estado", "Progreso %", "Nota conversación (IA)", "Nota reflexión (IA)", "Nota docente", "Intentos", "Última actualización"},
	"fr": {"Élève", "E-mail", "Devoir", "Statut", "Progression %", "Note conversation (IA)", "Note réflexion (IA)", "Note enseignant", "Tentatives", "Dernière mise à jour"},
	"de": {"Schüler/in", "E-Mail", "Aufgabe", "Status", "Fortschritt %", "Note Gespräch (KI)", "Note Reflexion (KI)", "Note Lehrkraft", "Versuche", "Letzte Änderung"},
}

var gradeStatuses = map[string]map[string]string{
	"it": {"todo": "Da iniziare", domain.SessionActive: "In corso", domain.SessionGoalReached: "Obiettivo raggiunto", domain.SessionTurnLimit: "Turni esauriti", domain.SessionCompleted: "Completata", domain.SessionAbandoned: "Abbandonata"},
	"en": {"todo": "Not started", domain.SessionActive: "In progress", domain.SessionGoalReached: "Goal reached", domain.SessionTurnLimit: "Turn limit", domain.SessionCompleted: "Completed", domain.SessionAbandoned: "Abandoned"},
	"es": {"todo": "Sin empezar", domain.SessionActive: "En curso", domain.SessionGoalReached: "Objetivo alcanzado", domain.SessionTurnLimit: "Turnos agotados", domain.SessionCompleted: "Completada", domain.SessionAbandoned: "Abandonada"},
	"fr": {"todo": "Pas commencé", domain.SessionActive: "En cours", domain.SessionGoalReached: "Objectif atteint", domain.SessionTurnLimit: "Tours épuisés", domain.SessionCompleted: "Terminée", domain.SessionAbandoned: "Abandonnée"},
	"de": {"todo": "Nicht begonnen", domain.SessionActive: "Läuft", domain.SessionGoalReached: "Ziel erreicht", domain.SessionTurnLimit: "Runden aufgebraucht", domain.SessionCompleted: "Abgeschlossen", domain.SessionAbandoned: "Abgebrochen"},
}

// writeGradesXLSX sends rows as an .xlsx download named after title.
func writeGradesXLSX(w http.ResponseWriter, title, locale string, rows []app.GradeRow) {
	locale = app.NormLocale(locale)
	f := excelize.NewFile()
	defer f.Close()
	const sheet = "Sheet1"
	headers := gradeHeaders[locale]
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
	for i, r := range rows {
		status, progress, updated := gradeStatuses[locale]["todo"], any(""), ""
		var conv, refl, teacher any = "", "", ""
		if s := r.Session; s != nil {
			status, progress, updated = gradeStatuses[locale][s.Status], s.Progress, s.UpdatedAt
			conv, refl, teacher = optional(s.ScoreConversation), optional(s.ScoreReflection), optional(s.TeacherScore)
		}
		cell, _ := excelize.CoordinatesToCellName(1, i+2)
		_ = f.SetSheetRow(sheet, cell, &[]any{r.Student, r.Email, r.Assignment, status, progress, conv, refl, teacher, r.Attempts, updated})
	}
	bold, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}})
	last, _ := excelize.ColumnNumberToName(len(headers))
	_ = f.SetCellStyle(sheet, "A1", last+"1", bold)
	_ = f.SetColWidth(sheet, "A", last, 18)
	_ = f.SetPanes(sheet, &excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft"})

	name := strings.Map(func(r rune) rune {
		if strings.ContainsRune(`\/:*?"<>|`, r) {
			return '-'
		}
		return r
	}, title) + ".xlsx"
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="grades.xlsx"; filename*=UTF-8''%s`, url.PathEscape(name)))
	if err := f.Write(w); err != nil {
		writeErr(w, 500, "internal", err.Error())
	}
}

// handleClassGrades exports the grades of every assignment of a class.
func (s *Server) handleClassGrades(w http.ResponseWriter, r *http.Request) {
	u, classID, ok := s.managedClass(w, r)
	if !ok {
		return
	}
	c, err := s.Classes.Get(classID)
	if err != nil {
		writeErr(w, 404, "not_found", "class not found")
		return
	}
	assignments, err := s.Assignments.ListForClass(classID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	rows, err := s.AssignmentSvc.Grades(assignments)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeGradesXLSX(w, c.Name, u.Locale, rows)
}

// handleAssignmentGrades exports the grades of one assignment.
func (s *Server) handleAssignmentGrades(w http.ResponseWriter, r *http.Request) {
	u, a, ok := s.managedAssignment(w, r)
	if !ok {
		return
	}
	rows, err := s.AssignmentSvc.Grades([]*domain.Assignment{a})
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeGradesXLSX(w, a.ClassName+" - "+a.Title, u.Locale, rows)
}
