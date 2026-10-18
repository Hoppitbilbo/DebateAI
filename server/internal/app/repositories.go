package app

import (
	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Repositories the application depends on (Dependency Inversion): the
// interfaces are defined here, by their consumer, and implemented by the
// types in package store. Tests may substitute any of them.

// settingsStore persists the settings documents.
type settingsStore interface {
	Load(key string, dst any) bool
	Save(key string, v any) error
}

type userStore interface {
	Get(id int64) (*domain.User, error)
	GetByEmail(email string) (*domain.User, error)
	Search(q, role string, limit int) ([]domain.User, error)
	Create(email, name, passwordHash, role, locale string) (int64, error)
	Update(id int64, p domain.UserPatch) error
	Delete(id int64) error
	PasswordHash(id int64) (string, error)
	SetPasswordHash(id int64, hash string) error
	RecordLogin(id int64) error
	Count(role string) int
}

type authSessionStore interface {
	Create(tokenHash string, userID int64, expiresAt string) error
	Lookup(tokenHash string) (userID int64, expiresAt string, err error)
	Delete(tokenHash string) error
	DeleteForUser(userID int64) error
	PurgeExpired() error
}

type inviteStore interface {
	ListAll(limit int) []domain.Invite
	ListByInviter(userID int64, limit int) []domain.Invite
	ListPendingForClass(classID int64) []domain.Invite
	Get(id int64) (*domain.Invite, error)
	FindByToken(tokenHash, kind string) (*domain.Invite, error)
	Create(n domain.NewInvite) (int64, error)
	MarkAccepted(id int64) error
	MarkSent(id int64) error
	Delete(id int64) error
	CountPending() int
}

type classStore interface {
	Get(id int64) (*domain.Class, error)
	Name(id int64) string
	ListAll() ([]*domain.Class, error)
	ListTaughtBy(userID int64) ([]*domain.Class, error)
	ListJoinedBy(userID int64) ([]*domain.Class, error)
	FindByJoinCode(code string) (*domain.Class, error)
	Create(name, description string, ownerID int64) (int64, error)
	Update(id int64, p domain.ClassPatch) error
	Delete(id int64) error
	SetJoinCode(id int64, code string) error
	CountActive() int

	Members(classID int64) []domain.Member
	Students(classID int64) ([]domain.User, error)
	CountStudents(classID int64) int
	CountMemberships(userID int64) int
	AddMember(classID, userID int64, role string) error
	RemoveMember(classID, userID int64) error
	IsMember(classID, userID int64) bool
	IsOwner(classID, userID int64) bool
	Teaches(classID, userID int64) bool
	TeachesStudent(teacherID, studentID int64) bool
}

type assignmentStore interface {
	Get(id int64) (*domain.Assignment, error)
	ListForClass(classID int64) ([]*domain.Assignment, error)
	ListForStudent(userID int64) ([]*domain.Assignment, error)
	Create(n domain.NewAssignment) (int64, error)
	Update(id int64, p domain.AssignmentPatch) error
	Delete(id int64) error
	Count() int
}

type sessionStore interface {
	Summary(id int64) (*domain.SessionSummary, error)
	Detail(id int64) (*domain.SessionDetail, error)
	Latest(userID, assignmentID int64) *domain.SessionSummary
	Best(userID, assignmentID int64) *domain.SessionSummary
	ListForUser(userID int64, limit int) ([]*domain.SessionSummary, error)
	BestPerStudent(classID int64) ([]domain.ProgressCell, error)
	Owner(id int64) (userID *int64, status string, err error)
	Create(n domain.NewSession) (int64, error)
	AbandonEmpty(userID, assignmentID int64) error
	SaveTranscript(id int64, transcriptJSON string, turns int, context *string) error
	SaveJudgement(id int64, judgementJSON string, progress int) error
	SetStatus(id int64, status string) error
	Complete(id int64, c domain.SessionCompletion) error
	AddCost(id int64, usd float64) error
	CountWithTurns() int
	CountStarted(assignmentID int64) int
	CountFinished(assignmentID int64) int
	CountAttempts(userID, assignmentID int64) int
}

type providerStore interface {
	Get(id int64) (*domain.Provider, error)
	List() []domain.Provider
	Create(name, kind, baseURL, apiKeyEnc string) (int64, error)
	Update(id int64, p domain.ProviderPatch) error
	Delete(id int64) error
	SetModels(id int64, models []ai.ModelInfo) error
	Name(id int64) string
	BaseURL(id int64) string
	Count(onlyEnabled bool) int
}

type priceStore interface {
	Get(providerID int64, model string) (inPerM, outPerM float64, ok bool)
	List() ([]domain.ModelPrice, error)
	Put(providerID int64, model string, inPerM, outPerM float64) error
	Import(providerID int64, model string, inPerM, outPerM float64) error
	Delete(providerID int64, model string) error
}

type usageStore interface {
	Insert(u domain.UsageRecord) error
	SpendSince(since string) float64
	UserSpendSince(userID int64, since string) float64
	CountSince(since string, onlyErrors bool) int
	CountUserRequestsSince(userID int64, since, excludedTask string) int
	Aggregate(since string, by domain.UsageGrouping, limit int) []domain.UsageAggregate
	Recent(limit int) ([]domain.UsageLogRow, error)
}
