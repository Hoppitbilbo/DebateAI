package app

import (
	"log"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Password recovery: a link e-mailed to the account, or (accounts without
// e-mail) a link the owner of the student's class or an admin hands over.
// Both are password_resets rows used once by ResetPassword.

// RequestReset e-mails a password reset link to an active account. It never
// reports whether the address exists, so it cannot be used to find accounts;
// a username or an account without e-mail gets nothing.
func (a *authService) RequestReset(email, baseURL string) {
	email = strings.TrimSpace(strings.ToLower(email))
	if !validEmail(email) {
		return
	}
	u, err := a.users.GetByEmail(email)
	if err != nil || !u.Active || u.IsGuest() || u.Email == "" {
		return
	}
	tok := randomToken(24)
	err = a.resets.Issue(domain.NewPasswordReset{TokenHash: hashToken(tok), UserID: u.ID,
		ExpiresAt: time.Now().Add(resetLinkTTL).UTC().Format(time.RFC3339)})
	if err != nil {
		log.Printf("password reset for user %d: %v", u.ID, err)
		return
	}
	subj, body := RenderMail("reset", u.Locale, map[string]string{"site": a.siteName(), "name": u.Name, "link": resetLink(baseURL, tok)})
	// Sent in the request (bounded by the SMTP timeouts): a queued mail may
	// wait, on a serverless host, longer than the link lives. A failed send
	// is queued, so the outbox still retries it.
	if err := a.mail.SendMail(u.Email, subj, body); err != nil {
		log.Printf("password reset mail for user %d: %v, queued", u.ID, err)
		a.mail.SendMailAsync(u.Email, subj, body)
	}
}

func resetLink(baseURL, token string) string { return baseURL + "/reset-password?token=" + token }

// ResetPassword sets a new password from a reset link. The password is
// checked and hashed first; then, in one transaction, the link is used
// (once, unexpired and, for an assisted link, still allowed), the other
// links are invalidated and every login of the account ends. It returns
// domain.ErrResetLinkInvalid for a link that cannot be used.
func (a *authService) ResetPassword(token, password string) (*domain.User, error) {
	hash, err := hashPassword(password)
	if err != nil {
		return nil, err
	}
	uid, err := a.resets.Consume(hashToken(token), hash)
	if err != nil {
		return nil, err
	}
	return a.users.Get(uid)
}

// ResetLink is an assisted reset link, shown once to the teacher.
type ResetLink struct {
	URL       string `json:"url"`
	ExpiresAt string `json:"expiresAt"`
}

// mayIssueAssistedReset: an admin, or the teacher who owns the class.
// Co-teachers may not.
func mayIssueAssistedReset(u *domain.User, cl *domain.Class) bool {
	return u.Active && (u.Role == domain.RoleAdmin ||
		(u.Role == domain.RoleTeacher && cl.OwnerID != nil && *cl.OwnerID == u.ID))
}

// AssistedReset gives issuer a link, valid assistedResetTTL, to set a new
// password for a student account without e-mail. It is allowed only from
// the class the account was created in, while the class is active and the
// account is still its student, to its owner or an admin. It returns
// ErrNotClassStudent (no such class or student), ErrResetForbidden (wrong
// issuer or not the account's class) or domain.ErrResetNotAllowed (the
// account or class does not qualify). A new link replaces the previous one.
func (a *authService) AssistedReset(issuer *domain.User, classID, studentID int64, baseURL string) (*ResetLink, error) {
	cl, err := a.classes.Get(classID)
	if err != nil {
		return nil, ErrNotClassStudent
	}
	if !mayIssueAssistedReset(issuer, cl) {
		return nil, ErrResetForbidden
	}
	student, err := a.users.Get(studentID)
	if err != nil || !a.classes.IsMember(classID, studentID) {
		return nil, ErrNotClassStudent
	}
	if student.Email != "" || student.IsGuest() || student.Role != domain.RoleStudent || !student.Active || cl.Archived {
		return nil, domain.ErrResetNotAllowed
	}
	if student.RecoveryClassID == nil || *student.RecoveryClassID != classID {
		return nil, ErrResetForbidden // added to this class later: its teacher gets no authority
	}
	tok := randomToken(24)
	expires := time.Now().Add(assistedResetTTL).UTC().Format(time.RFC3339)
	err = a.resets.Issue(domain.NewPasswordReset{TokenHash: hashToken(tok), UserID: studentID, ExpiresAt: expires,
		IssuedBy: &issuer.ID, ClassID: &classID})
	if err != nil {
		return nil, err
	}
	return &ResetLink{URL: resetLink(baseURL, tok), ExpiresAt: expires}, nil
}
