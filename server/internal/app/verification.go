package app

import (
	"encoding/json"
	"log"
	"strings"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Verified transcripts: the browser saves the conversation, so it could
// save one that never happened. The server keeps every AI line it sent to
// the student of an attempt (replyStore); when a transcript is saved, the
// AI lines it does not recognise are counted, shown to the teacher, and
// left out of what the judge and the final evaluation read. The student's
// own lines need no check: they are the student's work anyway.
//
// Two kinds of AI lines are never produced by the chat endpoint:
//   - the written greeting shown when the AI could not open the conversation
//     (before the student's first message: left out, but not counted);
//   - the teacher's hints of the mystery game, recognised from the assignment.
// Voice lines go from the browser to the provider directly: an attempt that
// used voice keeps them (they cannot be checked) and is marked as such.
//
// The app's own notices (role "system": the written intro when the opening
// failed, the mystery game's final-guess log) are written by the browser
// too, and the judge would read them as coming from the platform. They are
// left out of the evidence; what they say that matters reaches the
// evaluation as the activity's facts. They are not counted: the real ones
// are part of every normal attempt.

type replyStore interface {
	Record(sessionID int64, text string) error
	ForSession(sessionID int64) ([]string, error)
}

// RecordReply notes an AI line sent to the student of session id (also the
// part of an answer the student stopped).
func (svc *sessionService) RecordReply(id int64, text string) {
	if text = strings.TrimSpace(text); text != "" {
		logIfErr("record reply", svc.replies.Record(id, text))
	}
}

// transcriptCheck is what the server makes of a saved conversation.
type transcriptCheck struct {
	evidence   []TranscriptMessage // what the judge and the evaluation may read
	unverified int                 // unrecognised AI lines after the student's first message
	voice      bool
}

// checkTranscript compares the AI lines of msgs with the replies the server
// produced and the teacher's hints. With voice, the lines stay in the
// evidence (they cannot be checked) and are still counted.
func checkTranscript(msgs []TranscriptMessage, replies, hints []string, voice bool) transcriptCheck {
	c := transcriptCheck{evidence: make([]TranscriptMessage, 0, len(msgs)), voice: voice}
	studentSpoke := false
	for _, m := range msgs {
		if m.Role == ai.RoleUser {
			studentSpoke = true
		}
		if m.Role == roleSystem {
			continue
		}
		if m.Role != ai.RoleAssistant || producedByServer(m.Content, replies, hints) {
			c.evidence = append(c.evidence, m)
			continue
		}
		if studentSpoke {
			c.unverified++
		}
		if voice {
			c.evidence = append(c.evidence, m)
		}
	}
	return c
}

// emptyAnswer is what the chat shows for an answer without text.
const emptyAnswer = "…"

// minHintChars keeps a very short hint from matching any line.
const minHintChars = 3

// producedByServer: the line is a reply the server sent, or the part of one
// that was shown before the student stopped it, or one of the teacher's hints.
func producedByServer(line string, replies, hints []string) bool {
	line = strings.TrimSpace(line)
	if line == "" || line == emptyAnswer {
		return true
	}
	for _, r := range replies {
		if strings.HasPrefix(r, line) {
			return true
		}
	}
	for _, h := range hints {
		if h = strings.TrimSpace(h); len(h) >= minHintChars && strings.Contains(line, h) {
			return true
		}
	}
	return false
}

// teacherHints reads the mystery game's hints from an assignment's setup.
func teacherHints(a *domain.Assignment) []string {
	if a == nil {
		return nil
	}
	var cfg struct {
		Hints []string `json:"hints"`
	}
	_ = json.Unmarshal(a.Config, &cfg)
	return cfg.Hints
}

// check verifies the conversation msgs of attempt d (with assignment a, if any).
func (svc *sessionService) check(d *domain.SessionDetail, a *domain.Assignment, msgs []TranscriptMessage) transcriptCheck {
	replies, err := svc.replies.ForSession(d.ID)
	if err != nil {
		log.Printf("verify transcript %d: %v", d.ID, err)
	}
	voice, err := svc.voice.UsedBySession(d.ID)
	if err != nil {
		log.Printf("verify transcript %d: %v", d.ID, err)
	}
	return checkTranscript(msgs, replies, teacherHints(a), voice)
}

// voiceStore tells whether an attempt used voice (a live grant was issued for it).
type voiceStore interface {
	UsedBySession(sessionID int64) (bool, error)
}
