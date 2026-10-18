package store

import (
	"database/sql"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Prices is the repository of model prices (model_prices table).
type Prices struct{ db *sql.DB }

func NewPrices(db *sql.DB) *Prices { return &Prices{db: db} }

// Get returns the price of a model; ok is false when none (or a negative one) is stored.
func (r *Prices) Get(providerID int64, model string) (inPerM, outPerM float64, ok bool) {
	err := r.db.QueryRow(`SELECT input_per_m, output_per_m FROM model_prices WHERE provider_id = ? AND model = ?`, providerID, model).Scan(&inPerM, &outPerM)
	return inPerM, outPerM, err == nil && inPerM >= 0 && outPerM >= 0
}

// List returns all prices by provider name and model.
func (r *Prices) List() ([]domain.ModelPrice, error) {
	rows, err := r.db.Query(`SELECT p.provider_id, COALESCE(pr.name,''), p.model, p.input_per_m, p.output_per_m FROM model_prices p LEFT JOIN providers pr ON pr.id = p.provider_id ORDER BY pr.name, p.model`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.ModelPrice{}
	for rows.Next() {
		var x domain.ModelPrice
		if rows.Scan(&x.ProviderID, &x.ProviderName, &x.Model, &x.InputPerM, &x.OutputPerM) == nil {
			out = append(out, x)
		}
	}
	return out, rows.Err()
}

// Put sets the price of a model, replacing any previous one.
func (r *Prices) Put(providerID int64, model string, inPerM, outPerM float64) error {
	_, err := r.db.Exec(`INSERT INTO model_prices(provider_id, model, input_per_m, output_per_m) VALUES(?,?,?,?)
		ON CONFLICT(provider_id, model) DO UPDATE SET input_per_m = excluded.input_per_m, output_per_m = excluded.output_per_m`,
		providerID, model, inPerM, outPerM)
	return err
}

// Import sets the price of a model only if none is stored (prices set by the
// admin win over those published by the provider).
func (r *Prices) Import(providerID int64, model string, inPerM, outPerM float64) error {
	_, err := r.db.Exec(`INSERT OR IGNORE INTO model_prices(provider_id, model, input_per_m, output_per_m) VALUES(?,?,?,?)`, providerID, model, inPerM, outPerM)
	return err
}

func (r *Prices) Delete(providerID int64, model string) error {
	_, err := r.db.Exec(`DELETE FROM model_prices WHERE provider_id = ? AND model = ?`, providerID, model)
	return err
}
