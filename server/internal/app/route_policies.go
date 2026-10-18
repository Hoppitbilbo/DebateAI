package app

import (
	"encoding/json"
	"log"
	"strconv"
	"strings"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

// Default routes per provider kind (Strategy pattern, registered by kind):
// when a provider is added, its policy fills the tasks that have no target
// yet with sensible models from its list. A new provider kind brings its own
// policy here instead of a new case in autoRoute.

// routePolicy adds the provider's default targets to rt.
type routePolicy func(rt *RoutingSettings, providerID int64, models []ai.ModelInfo)

var defaultRoutes = map[string]routePolicy{
	ai.KindJev:    jevRoutes,
	ai.KindGemini: geminiRoutes,
}

// routePolicyFor returns the policy of a kind; OpenAI-compatible and
// Anthropic providers use the first free (or first listed) model everywhere.
func routePolicyFor(kind string) routePolicy {
	if p, ok := defaultRoutes[kind]; ok {
		return p
	}
	return firstModelRoutes
}

// autoRoute applies the default policy of a newly added provider.
func (s *Server) autoRoute(providerID int64, kind string) {
	var models []ai.ModelInfo
	var raw string
	_ = s.db.QueryRow(`SELECT models_json FROM providers WHERE id = ?`, providerID).Scan(&raw)
	_ = json.Unmarshal([]byte(raw), &models)
	rt := s.routing()
	routePolicyFor(kind)(&rt, providerID, models)
	if err := putSetting(s.db, "routing", rt); err != nil {
		log.Printf("auto-route provider %d: %v", providerID, err)
	}
}

// addIfEmpty routes task to model unless the admin already configured it.
func addIfEmpty(rt *RoutingSettings, task string, providerID int64, model string) {
	if model != "" && len(rt.Tasks[task]) == 0 {
		rt.Tasks[task] = []RouteTarget{{providerID, model}}
	}
}

// pickModel returns the first preferred id that is listed, else the first
// preferred id anyway (a known-good default even if listing failed), else
// the first listed model.
func pickModel(models []ai.ModelInfo, prefer ...string) string {
	for _, p := range prefer {
		for _, m := range models {
			if m.ID == p {
				return p
			}
		}
	}
	for _, p := range prefer {
		if p != "" {
			return p
		}
	}
	if len(models) > 0 {
		return models[0].ID
	}
	return ""
}

// jevRoutes puts Jev first for judging, since it is purpose-built for it,
// and keeps the other judge targets as fallback.
func jevRoutes(rt *RoutingSettings, providerID int64, models []ai.ModelInfo) {
	m := pickModel(models, "jev-latest", "jev-1.13-free", "jev-1.13")
	if m == "" {
		return
	}
	rest := rt.Tasks[TaskJudge][:0:0]
	for _, t := range rt.Tasks[TaskJudge] {
		if t.ProviderID != providerID {
			rest = append(rest, t)
		}
	}
	rt.Tasks[TaskJudge] = append([]RouteTarget{{providerID, m}}, rest...)
}

// geminiRoutes follows Google's lineup: the newest Flash for chat and
// evaluation, Flash Lite for quick tasks, the newest Live model for voice.
func geminiRoutes(rt *RoutingSettings, providerID int64, models []ai.ModelInfo) {
	flash := newestFlash(models, false, false, "gemini-2.5-flash")
	addIfEmpty(rt, TaskChat, providerID, flash)
	addIfEmpty(rt, TaskEvaluation, providerID, flash)
	addIfEmpty(rt, TaskUtility, providerID, newestFlash(models, false, true, flash))
	addIfEmpty(rt, TaskJudge, providerID, newestFlash(models, false, true, flash))
	addIfEmpty(rt, TaskLive, providerID, newestFlash(models, true, false, "gemini-3.1-flash-live-preview"))
}

// firstModelRoutes uses the first free model (or the first listed one) for
// every text task.
func firstModelRoutes(rt *RoutingSettings, providerID int64, models []ai.ModelInfo) {
	var first string
	for _, m := range models {
		if m.Free {
			first = m.ID
			break
		}
	}
	if first == "" {
		first = pickModel(models)
	}
	for _, task := range []string{TaskChat, TaskEvaluation, TaskUtility, TaskJudge} {
		addIfEmpty(rt, task, providerID, first)
	}
}

// newestFlash returns the most recent listed Gemini "flash" model with the
// requested live/lite variant, so new installs follow Google's lineup
// instead of a hard-coded name.
func newestFlash(models []ai.ModelInfo, live, lite bool, fallback string) string {
	best := ""
	for _, m := range models {
		id := strings.TrimPrefix(m.ID, "models/")
		if m.SupportLive != live || !strings.Contains(id, "flash") || strings.Contains(id, "lite") != lite ||
			strings.Contains(id, "image") || strings.Contains(id, "tts") || strings.Contains(id, "audio") || strings.Contains(id, "thinking") {
			continue
		}
		if best == "" || geminiVersion(id) > geminiVersion(best) || (geminiVersion(id) == geminiVersion(best) && id > best) {
			best = id
		}
	}
	if best != "" {
		return best
	}
	return pickModel(models, fallback)
}

// geminiVersion extracts the version number from ids such as
// "gemini-3.1-flash-live-preview" or "gemini-live-2.5-flash" (0 if none).
func geminiVersion(id string) float64 {
	for _, part := range strings.Split(id, "-") {
		if v, err := strconv.ParseFloat(part, 64); err == nil {
			return v
		}
	}
	return 0
}
