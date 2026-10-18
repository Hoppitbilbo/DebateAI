package store

import (
	"database/sql"
	"encoding/json"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Providers is the repository of AI providers (providers table).
type Providers struct{ db *sql.DB }

func NewProviders(db *sql.DB) *Providers { return &Providers{db: db} }

const providerCols = `id, name, kind, base_url, api_key_enc, models_json, enabled, created_at`

func scanProvider(row interface{ Scan(...any) error }) (*domain.Provider, error) {
	var p domain.Provider
	var models string
	var enabled int
	if err := row.Scan(&p.ID, &p.Name, &p.Kind, &p.BaseURL, &p.APIKeyEnc, &models, &enabled, &p.CreatedAt); err != nil {
		return nil, err
	}
	p.Enabled = enabled == 1
	_ = json.Unmarshal([]byte(models), &p.Models)
	if p.Models == nil {
		p.Models = []ai.ModelInfo{}
	}
	return &p, nil
}

func (r *Providers) Get(id int64) (*domain.Provider, error) {
	return scanProvider(r.db.QueryRow(`SELECT `+providerCols+` FROM providers WHERE id = ?`, id))
}

// List returns all providers in creation order.
func (r *Providers) List() []domain.Provider {
	out := []domain.Provider{}
	rows, err := r.db.Query(`SELECT ` + providerCols + ` FROM providers ORDER BY id`)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		if p, err := scanProvider(rows); err == nil {
			out = append(out, *p)
		}
	}
	return out
}

func (r *Providers) Create(name, kind, baseURL, apiKeyEnc string) (int64, error) {
	res, err := r.db.Exec(`INSERT INTO providers(name, kind, base_url, api_key_enc, created_at) VALUES(?,?,?,?,?)`,
		name, kind, baseURL, apiKeyEnc, domain.Now())
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// Update applies the non-nil fields of p in one transaction.
func (r *Providers) Update(id int64, p domain.ProviderPatch) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	set := func(col string, v any) {
		if err == nil {
			_, err = tx.Exec(`UPDATE providers SET `+col+` = ? WHERE id = ?`, v, id)
		}
	}
	if p.Name != nil {
		set("name", *p.Name)
	}
	if p.BaseURL != nil {
		set("base_url", *p.BaseURL)
	}
	if p.APIKeyEnc != nil {
		set("api_key_enc", *p.APIKeyEnc)
	}
	if p.Enabled != nil {
		set("enabled", boolInt(*p.Enabled))
	}
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Providers) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM providers WHERE id = ?`, id)
	return err
}

// SetModels stores the model list fetched from the provider.
func (r *Providers) SetModels(id int64, models []ai.ModelInfo) error {
	b, err := json.Marshal(models)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(`UPDATE providers SET models_json = ? WHERE id = ?`, string(b), id)
	return err
}

// Name returns the provider name, or "" when it does not exist.
func (r *Providers) Name(id int64) string {
	var name string
	_ = r.db.QueryRow(`SELECT name FROM providers WHERE id = ?`, id).Scan(&name)
	return name
}

// BaseURL returns the provider endpoint, or "" when it does not exist.
func (r *Providers) BaseURL(id int64) string {
	var base string
	_ = r.db.QueryRow(`SELECT base_url FROM providers WHERE id = ?`, id).Scan(&base)
	return base
}

// Count returns the number of providers, only enabled ones when onlyEnabled.
func (r *Providers) Count(onlyEnabled bool) int {
	if onlyEnabled {
		return count(r.db, `SELECT COUNT(*) FROM providers WHERE enabled = 1`)
	}
	return count(r.db, `SELECT COUNT(*) FROM providers`)
}
