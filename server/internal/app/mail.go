package app

import (
	"crypto/tls"
	"errors"
	"fmt"
	"html"
	"log"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"
)

// mailTexts holds the localized e-mail templates. Placeholders:
// {site} {name} {inviter} {class} {link} {role} {title} {due}
var mailTexts = map[string]map[string][2]string{
	"invite": {
		"it": {"Sei stato invitato su {site}", "Ciao,\n\n{inviter} ti ha invitato su {site} come {role}{class}.\n\nCompleta la registrazione da questo link (valido 14 giorni):\n{link}\n\nSe non ti aspettavi questo invito puoi ignorare questa email."},
		"en": {"You have been invited to {site}", "Hello,\n\n{inviter} invited you to {site} as {role}{class}.\n\nComplete your registration here (valid for 14 days):\n{link}\n\nIf you were not expecting this invitation you can ignore this email."},
		"es": {"Has sido invitado a {site}", "Hola,\n\n{inviter} te ha invitado a {site} como {role}{class}.\n\nCompleta tu registro aquí (válido 14 días):\n{link}\n\nSi no esperabas esta invitación puedes ignorar este correo."},
		"fr": {"Vous êtes invité sur {site}", "Bonjour,\n\n{inviter} vous a invité sur {site} en tant que {role}{class}.\n\nTerminez votre inscription ici (valable 14 jours) :\n{link}\n\nSi vous n'attendiez pas cette invitation, ignorez cet e-mail."},
		"de": {"Einladung zu {site}", "Hallo,\n\n{inviter} hat dich als {role}{class} zu {site} eingeladen.\n\nSchließe deine Registrierung hier ab (14 Tage gültig):\n{link}\n\nWenn du diese Einladung nicht erwartet hast, ignoriere diese E-Mail."},
	},
	"welcome": {
		"it": {"Benvenuto su {site}", "Ciao {name},\n\nla tua registrazione su {site} è completata.\nAccedi qui: {link}\n\nBuon lavoro!"},
		"en": {"Welcome to {site}", "Hi {name},\n\nyour registration on {site} is complete.\nSign in here: {link}\n\nEnjoy!"},
		"es": {"Bienvenido a {site}", "Hola {name},\n\ntu registro en {site} se ha completado.\nAccede aquí: {link}\n\n¡Buen trabajo!"},
		"fr": {"Bienvenue sur {site}", "Bonjour {name},\n\nvotre inscription sur {site} est terminée.\nConnectez-vous ici : {link}\n\nBon travail !"},
		"de": {"Willkommen bei {site}", "Hallo {name},\n\ndeine Registrierung bei {site} ist abgeschlossen.\nMelde dich hier an: {link}\n\nViel Erfolg!"},
	},
	"reset": {
		"it": {"Reimposta la password di {site}", "Ciao {name},\n\nper scegliere una nuova password apri questo link (valido 2 ore):\n{link}\n\nSe non hai richiesto il reset ignora questa email."},
		"en": {"Reset your {site} password", "Hi {name},\n\nopen this link to choose a new password (valid for 2 hours):\n{link}\n\nIf you did not ask for a reset, ignore this email."},
		"es": {"Restablece tu contraseña de {site}", "Hola {name},\n\nabre este enlace para elegir una nueva contraseña (válido 2 horas):\n{link}\n\nSi no lo solicitaste, ignora este correo."},
		"fr": {"Réinitialisez votre mot de passe {site}", "Bonjour {name},\n\nouvrez ce lien pour choisir un nouveau mot de passe (valable 2 heures) :\n{link}\n\nSi vous n'êtes pas à l'origine de la demande, ignorez cet e-mail."},
		"de": {"Passwort für {site} zurücksetzen", "Hallo {name},\n\nöffne diesen Link, um ein neues Passwort zu wählen (2 Stunden gültig):\n{link}\n\nWenn du das nicht angefordert hast, ignoriere diese E-Mail."},
	},
	"added": {
		"it": {"Sei stato aggiunto alla classe {class}", "Ciao {name},\n\n{inviter} ti ha aggiunto alla classe \"{class}\" su {site}.\nApri la tua area: {link}"},
		"en": {"You were added to the class {class}", "Hi {name},\n\n{inviter} added you to the class \"{class}\" on {site}.\nOpen your dashboard: {link}"},
		"es": {"Te han añadido a la clase {class}", "Hola {name},\n\n{inviter} te ha añadido a la clase \"{class}\" en {site}.\nAbre tu panel: {link}"},
		"fr": {"Vous avez été ajouté à la classe {class}", "Bonjour {name},\n\n{inviter} vous a ajouté à la classe « {class} » sur {site}.\nOuvrez votre espace : {link}"},
		"de": {"Du wurdest der Klasse {class} hinzugefügt", "Hallo {name},\n\n{inviter} hat dich der Klasse „{class}“ auf {site} hinzugefügt.\nÖffne dein Dashboard: {link}"},
	},
	"assignment": {
		"it": {"Nuovo compito: {title}", "Ciao {name},\n\nnella classe \"{class}\" è stato assegnato un nuovo compito: {title}{due}.\n\nAprilo qui: {link}"},
		"en": {"New assignment: {title}", "Hi {name},\n\na new assignment was published in \"{class}\": {title}{due}.\n\nOpen it here: {link}"},
		"es": {"Nueva tarea: {title}", "Hola {name},\n\nse ha publicado una nueva tarea en \"{class}\": {title}{due}.\n\nÁbrela aquí: {link}"},
		"fr": {"Nouveau devoir : {title}", "Bonjour {name},\n\nun nouveau devoir a été publié dans « {class} » : {title}{due}.\n\nOuvrez-le ici : {link}"},
		"de": {"Neue Aufgabe: {title}", "Hallo {name},\n\nin „{class}“ wurde eine neue Aufgabe veröffentlicht: {title}{due}.\n\nÖffne sie hier: {link}"},
	},
	"test": {
		"it": {"Email di prova da {site}", "La configurazione SMTP funziona correttamente."},
		"en": {"Test email from {site}", "Your SMTP configuration works."},
		"es": {"Correo de prueba de {site}", "La configuración SMTP funciona correctamente."},
		"fr": {"E-mail de test de {site}", "La configuration SMTP fonctionne."},
		"de": {"Test-E-Mail von {site}", "Die SMTP-Konfiguration funktioniert."},
	},
}

var roleNames = map[string]map[string]string{
	"it": {"admin": "amministratore", "teacher": "docente", "student": "studente"},
	"en": {"admin": "administrator", "teacher": "teacher", "student": "student"},
	"es": {"admin": "administrador", "teacher": "docente", "student": "estudiante"},
	"fr": {"admin": "administrateur", "teacher": "enseignant", "student": "élève"},
	"de": {"admin": "Administrator", "teacher": "Lehrkraft", "student": "Schüler/in"},
}

var classPhrase = map[string]string{
	"it": " nella classe \"%s\"", "en": " in the class \"%s\"", "es": " en la clase \"%s\"",
	"fr": " dans la classe « %s »", "de": " in der Klasse „%s“",
}

var duePhrase = map[string]string{
	"it": " (scadenza %s)", "en": " (due %s)", "es": " (vence %s)", "fr": " (à rendre le %s)", "de": " (fällig am %s)",
}

func normLocale(l string) string {
	l = strings.ToLower(strings.TrimSpace(l))
	if len(l) > 2 {
		l = l[:2]
	}
	switch l {
	case "it", "en", "es", "fr", "de":
		return l
	}
	return "it"
}

func renderMail(kind, locale string, vars map[string]string) (string, string) {
	t := mailTexts[kind][normLocale(locale)]
	subject, body := t[0], t[1]
	for k, v := range vars {
		subject = strings.ReplaceAll(subject, "{"+k+"}", v)
		body = strings.ReplaceAll(body, "{"+k+"}", v)
	}
	return subject, body
}

var errSMTPNotConfigured = errors.New("SMTP is not configured")

// sendMail delivers a plain-text + HTML e-mail. When SMTP is not configured the
// message is logged so admins can still copy the links from the dashboard.
func (s *Server) sendMail(to, subject, body string) error {
	cfg := s.settingsSvc.SMTP()
	if cfg.Host == "" {
		log.Printf("[mail disabled] to=%s subject=%q\n%s", to, subject, body)
		return errSMTPNotConfigured
	}
	from := cfg.From
	if from == "" {
		from = cfg.Username
	}
	fromAddr, err := mail.ParseAddress(from)
	if err != nil {
		return fmt.Errorf("invalid From address: %w", err)
	}
	toAddr, err := mail.ParseAddress(to)
	if err != nil {
		return fmt.Errorf("invalid recipient: %w", err)
	}

	boundary := "debateai-" + randomToken(12)
	htmlBody := "<div style=\"font-family:system-ui,sans-serif;font-size:15px;line-height:1.5\">" +
		linkify(html.EscapeString(body)) + "</div>"
	var msg strings.Builder
	msg.WriteString("From: " + fromAddr.String() + "\r\n")
	msg.WriteString("To: " + toAddr.String() + "\r\n")
	msg.WriteString("Subject: " + mime.QEncoding.Encode("utf-8", subject) + "\r\n")
	msg.WriteString("Date: " + time.Now().Format(time.RFC1123Z) + "\r\n")
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: multipart/alternative; boundary=" + boundary + "\r\n\r\n")
	msg.WriteString("--" + boundary + "\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n" + body + "\r\n")
	msg.WriteString("--" + boundary + "\r\nContent-Type: text/html; charset=utf-8\r\n\r\n" + htmlBody + "\r\n")
	msg.WriteString("--" + boundary + "--\r\n")

	addr := net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port))
	var auth smtp.Auth
	if cfg.Username != "" {
		auth = smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	}

	var c *smtp.Client
	if cfg.Security == "tls" {
		conn, err := tls.DialWithDialer(&net.Dialer{Timeout: smtpDialTimeout}, "tcp", addr, &tls.Config{ServerName: cfg.Host})
		if err != nil {
			return err
		}
		c, err = smtp.NewClient(conn, cfg.Host)
		if err != nil {
			return err
		}
	} else {
		conn, err := net.DialTimeout("tcp", addr, smtpDialTimeout)
		if err != nil {
			return err
		}
		c, err = smtp.NewClient(conn, cfg.Host)
		if err != nil {
			return err
		}
		if cfg.Security == "starttls" {
			if err := c.StartTLS(&tls.Config{ServerName: cfg.Host}); err != nil {
				c.Close()
				return err
			}
		}
	}
	defer c.Close()
	if auth != nil {
		if err := c.Auth(auth); err != nil {
			return err
		}
	}
	if err := c.Mail(fromAddr.Address); err != nil {
		return err
	}
	if err := c.Rcpt(toAddr.Address); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write([]byte(msg.String())); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}

// sendMailAsync is used for bulk notifications so HTTP handlers stay fast.
func (s *Server) sendMailAsync(to, subject, body string) {
	go func() {
		if err := s.sendMail(to, subject, body); err != nil && !errors.Is(err, errSMTPNotConfigured) {
			log.Printf("mail to %s failed: %v", to, err)
		}
	}()
}

func linkify(s string) string {
	var out strings.Builder
	for i, line := range strings.Split(s, "\n") {
		if i > 0 {
			out.WriteString("<br>")
		}
		words := strings.Split(line, " ")
		for j, w := range words {
			if j > 0 {
				out.WriteString(" ")
			}
			if strings.HasPrefix(w, "http://") || strings.HasPrefix(w, "https://") {
				out.WriteString(`<a href="` + w + `">` + w + `</a>`)
			} else {
				out.WriteString(w)
			}
		}
	}
	return out.String()
}
