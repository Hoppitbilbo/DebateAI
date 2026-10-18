package app

import "github.com/Hoppitbilbo/DebateAI/server/internal/domain"

// Repositories the application depends on (Dependency Inversion): the
// interfaces are defined here, by their consumer, and implemented by the
// types in package store. Tests may substitute any of them.

// Transitional aliases while handlers move to the domain types.
type (
	User      = domain.User
	inviteRow = domain.Invite
)

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
