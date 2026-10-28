package app

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// roomTransfer takes the work out of a room: an export (Excel, or an
// encrypted file) and an import into a class, where each guest is matched
// with a student. The file is encrypted and authenticated with the server
// secret (AES-GCM): a file edited by hand is refused, and a lost file does
// not expose the students' conversations.
type roomTransfer struct {
	rooms       roomStore
	sessions    sessionStore
	assignments assignmentStore
	classes     classStore
	classSvc    *classService
	crypto      *Crypto
	endRoom     func(*domain.Room) error
	now         func() time.Time
}

const roomExportFormat = "debateai-room"
const roomExportVersion = 1

var (
	ErrBadExportFile    = errors.New("this is not a valid room file of this site")
	ErrBadImportMapping = errors.New("a guest can only be matched with a student of the class")
)

// RoomExport is the content of an exported room.
type RoomExport struct {
	Title        string          `json:"title"`
	AppType      string          `json:"appType"`
	AssignmentID *int64          `json:"assignmentId,omitempty"`
	CreatedAt    string          `json:"createdAt"`
	ExportedAt   string          `json:"exportedAt"`
	Guests       []ExportedGuest `json:"guests"`
}

type ExportedGuest struct {
	Nickname string                 `json:"nickname"`
	Avatar   string                 `json:"avatar"`
	Sessions []domain.SessionDetail `json:"sessions"`
}

// roomFile is the file a teacher downloads: a readable header and the
// sealed content.
type roomFile struct {
	Format     string `json:"format"`
	Version    int    `json:"version"`
	Title      string `json:"title"`
	ExportedAt string `json:"exportedAt"`
	Guests     int    `json:"guests"`
	Data       string `json:"data"`
}

// Export collects the guests of a room with their attempts.
func (svc *roomTransfer) Export(room *domain.Room) (*RoomExport, error) {
	guests, err := svc.rooms.Guests(room.ID)
	if err != nil {
		return nil, err
	}
	out := &RoomExport{Title: room.Title, AppType: room.AppType, AssignmentID: room.AssignmentID, CreatedAt: room.CreatedAt, ExportedAt: svc.now().UTC().Format(time.RFC3339), Guests: []ExportedGuest{}}
	for _, g := range guests {
		list, err := svc.sessions.ListForUser(g.UserID, roomAttemptsPerGuest)
		if err != nil {
			return nil, err
		}
		eg := ExportedGuest{Nickname: g.Nickname, Avatar: g.Avatar, Sessions: []domain.SessionDetail{}}
		for _, ss := range list {
			if d, err := svc.sessions.Detail(ss.ID); err == nil {
				d.UserID, d.UserName = nil, ""
				eg.Sessions = append(eg.Sessions, *d)
			}
		}
		out.Guests = append(out.Guests, eg)
	}
	return out, nil
}

// SealExport returns the downloadable file of an export.
func (svc *roomTransfer) SealExport(e *RoomExport) ([]byte, error) {
	plain, err := json.Marshal(e)
	if err != nil {
		return nil, err
	}
	return json.MarshalIndent(roomFile{Format: roomExportFormat, Version: roomExportVersion, Title: e.Title, ExportedAt: e.ExportedAt,
		Guests: len(e.Guests), Data: svc.crypto.Encrypt(string(plain))}, "", "  ")
}

// OpenExport reads a downloaded file back; ErrBadExportFile when it was not
// made by this server or was changed.
func (svc *roomTransfer) OpenExport(file string) (*RoomExport, error) {
	var f roomFile
	if err := json.Unmarshal([]byte(file), &f); err != nil || f.Format != roomExportFormat || f.Version != roomExportVersion {
		return nil, ErrBadExportFile
	}
	plain, err := svc.crypto.Decrypt(f.Data)
	if err != nil || plain == "" {
		return nil, ErrBadExportFile
	}
	var e RoomExport
	if err := json.Unmarshal([]byte(plain), &e); err != nil {
		return nil, ErrBadExportFile
	}
	return &e, nil
}

// ImportMatch pairs a guest (by nickname) with a student of the class;
// StudentID 0 discards the guest.
type ImportMatch struct {
	Nickname  string `json:"nickname"`
	StudentID int64  `json:"studentId"`
}

// ImportResult tells how many attempts were kept and how many guests discarded.
type ImportResult struct {
	Sessions  int `json:"sessions"`
	Students  int `json:"students"`
	Discarded int `json:"discarded"`
}

// studentMatches validates the matches against the students of a class and
// returns them by nickname.
func (svc *roomTransfer) studentMatches(classID int64, matches []ImportMatch) (map[string]int64, error) {
	students, err := svc.classes.Students(classID)
	if err != nil {
		return nil, err
	}
	inClass := map[int64]bool{}
	for _, s := range students {
		inClass[s.ID] = true
	}
	out := map[string]int64{}
	for _, m := range matches {
		if m.StudentID == 0 {
			continue
		}
		if !inClass[m.StudentID] {
			return nil, ErrBadImportMapping
		}
		out[strings.ToLower(domain.NormalizeNickname(m.Nickname))] = m.StudentID
	}
	return out, nil
}

// ImportRoom gives the attempts of the matched guests of an open room to
// the students of a class, then ends the room (the rest is deleted).
func (svc *roomTransfer) ImportRoom(u *domain.User, classID int64, room *domain.Room, matches []ImportMatch) (*ImportResult, error) {
	if !svc.classSvc.CanManage(u, classID) {
		return nil, ErrNotYourClass
	}
	byNick, err := svc.studentMatches(classID, matches)
	if err != nil {
		return nil, err
	}
	guests, err := svc.rooms.Guests(room.ID)
	if err != nil {
		return nil, err
	}
	res := &ImportResult{}
	students := map[int64]bool{}
	for _, g := range guests {
		studentID, ok := byNick[strings.ToLower(g.Nickname)]
		if !ok {
			res.Discarded++
			continue
		}
		if err := svc.rooms.MoveGuestSessions(g.UserID, studentID); err != nil {
			return nil, err
		}
		res.Sessions += g.Sessions
		students[studentID] = true
	}
	res.Students = len(students)
	return res, svc.endRoom(room)
}

// ImportFile stores the attempts of the matched guests of an exported room
// for the students of a class. An attempt keeps its assignment only when
// the assignment belongs to that class.
func (svc *roomTransfer) ImportFile(u *domain.User, classID int64, file string, matches []ImportMatch) (*ImportResult, error) {
	if !svc.classSvc.CanManage(u, classID) {
		return nil, ErrNotYourClass
	}
	e, err := svc.OpenExport(file)
	if err != nil {
		return nil, err
	}
	byNick, err := svc.studentMatches(classID, matches)
	if err != nil {
		return nil, err
	}
	var assignmentID *int64
	if e.AssignmentID != nil {
		if a, err := svc.assignments.Get(*e.AssignmentID); err == nil && a.ClassID == classID {
			assignmentID = &a.ID
		}
	}
	res := &ImportResult{}
	students := map[int64]bool{}
	for _, g := range e.Guests {
		studentID, ok := byNick[strings.ToLower(domain.NormalizeNickname(g.Nickname))]
		if !ok {
			res.Discarded++
			continue
		}
		for _, d := range g.Sessions {
			if _, err := svc.sessions.Import(studentID, assignmentID, d); err != nil {
				return nil, err
			}
			res.Sessions++
		}
		students[studentID] = true
	}
	res.Students = len(students)
	return res, nil
}

// RoomPreview lists the guests of an exported room, without their
// conversations, so the teacher can match them before importing.
type RoomPreview struct {
	Title     string         `json:"title"`
	AppType   string         `json:"appType"`
	CreatedAt string         `json:"createdAt"`
	Guests    []PreviewGuest `json:"guests"`
}

type PreviewGuest struct {
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	Sessions int    `json:"sessions"`
}

func (svc *roomTransfer) PreviewFile(file string) (*RoomPreview, error) {
	e, err := svc.OpenExport(file)
	if err != nil {
		return nil, err
	}
	out := &RoomPreview{Title: e.Title, AppType: e.AppType, CreatedAt: e.CreatedAt, Guests: []PreviewGuest{}}
	for _, g := range e.Guests {
		out.Guests = append(out.Guests, PreviewGuest{Nickname: g.Nickname, Avatar: g.Avatar, Sessions: len(g.Sessions)})
	}
	return out, nil
}
