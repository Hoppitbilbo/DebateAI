package app

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Bulk notifications (an assignment published, an invite) go through a
// database outbox delivered by one worker, instead of a goroutine per mail:
// a big class or a stalled SMTP server cannot pile up connections, and a
// mail survives a restart or a frozen serverless instance (it is due again
// once its lease ends).

type outboxStore interface {
	Enqueue(to, subject, body string) error
	Claim(limit int, leaseUntil string) ([]domain.OutboxMail, error)
	MarkSent(id int64) error
	MarkFailed(id int64, attempts int, errText string, retryAt *string) error
	CountPending() (int, error)
}

// mailOutbox queues mails and delivers them with send.
type mailOutbox struct {
	store outboxStore
	send  func(to, subject, body string) error
	now   func() time.Time
	kick  chan struct{} // wakes the worker after Enqueue
}

func newMailOutbox(store outboxStore, send func(to, subject, body string) error) *mailOutbox {
	return &mailOutbox{store: store, send: send, now: time.Now, kick: make(chan struct{}, 1)}
}

// outboxRetries is the wait before each new attempt; after the last one the
// mail is given up.
var outboxRetries = []time.Duration{time.Minute, 5 * time.Minute, 30 * time.Minute, 2 * time.Hour}

func (o *mailOutbox) enqueue(to, subject, body string) {
	if err := o.store.Enqueue(to, subject, body); err != nil {
		log.Printf("mail to %s not queued: %v", to, err)
		return
	}
	select {
	case o.kick <- struct{}{}:
	default: // the worker is already awake
	}
}

// Deliver sends the due mails, a batch at a time, until none is left or
// ctx ends. It returns how many were sent.
func (o *mailOutbox) Deliver(ctx context.Context) int {
	sent := 0
	for ctx.Err() == nil {
		lease := o.now().Add(outboxLease).UTC().Format(time.RFC3339)
		batch, err := o.store.Claim(outboxBatch, lease)
		if err != nil {
			log.Printf("mail outbox: %v", err)
			return sent
		}
		if len(batch) == 0 {
			return sent
		}
		for _, m := range batch {
			if o.deliver(m) {
				sent++
			}
		}
	}
	return sent
}

func (o *mailOutbox) deliver(m domain.OutboxMail) bool {
	err := o.send(m.To, m.Subject, m.Body)
	if err == nil {
		logIfErr("mail sent", o.store.MarkSent(m.ID))
		return true
	}
	attempts := m.Attempts + 1
	var retryAt *string
	if attempts <= len(outboxRetries) && !errors.Is(err, errSMTPNotConfigured) {
		at := o.now().Add(outboxRetries[attempts-1]).UTC().Format(time.RFC3339)
		retryAt = &at
	}
	log.Printf("mail to %s failed (attempt %d): %v", m.To, attempts, err)
	logIfErr("mail failed", o.store.MarkFailed(m.ID, attempts, err.Error(), retryAt))
	return false
}

// Run delivers the outbox when a mail is queued and every outboxPoll (for
// retries), until ctx ends.
func (o *mailOutbox) Run(ctx context.Context) {
	tick := time.NewTicker(outboxPoll)
	defer tick.Stop()
	for {
		o.Deliver(ctx)
		select {
		case <-ctx.Done():
			return
		case <-o.kick:
		case <-tick.C:
		}
	}
}

// outboxMailer sends single mails at once (the caller wants to know) and
// queues the bulk ones.
type outboxMailer struct {
	smtpMailer
	outbox *mailOutbox
}

func (m outboxMailer) SendMailAsync(to, subject, body string) {
	if !m.settings.MailConfigured() {
		_ = m.SendMail(to, subject, body) // logs the mail, as SendMail does without SMTP
		return
	}
	m.outbox.enqueue(to, subject, body)
}
