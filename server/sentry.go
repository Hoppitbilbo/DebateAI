package main

import (
	"net/http"
	"os"
	"runtime/debug"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
)

// Set by release builds; both the browser and API use the same commit SHA.
var buildRelease string

const (
	defaultEnvironment = "production"
	// Share of requests traced: all of them while developing, a sample in production.
	devTracesSampleRate  = 1.0
	prodTracesSampleRate = 0.1
	// AI requests are the ones test reports need; they are kept in full.
	aiTracesSampleRate = 1.0
	// sentryFlushTimeout is how long shutdown waits for queued events.
	sentryFlushTimeout = 2 * time.Second
)

func sentryOptions() sentry.ClientOptions {
	environment := environmentName()
	off := &sentry.KeyValueCollectionBehavior{Mode: sentry.CollectionOff}
	return sentry.ClientOptions{
		Dsn:              strings.TrimSpace(os.Getenv("SENTRY_DSN")),
		Environment:      environment,
		Release:          releaseName(),
		AttachStacktrace: true,
		EnableTracing:    true,
		TracesSampler:    tracesSampler(environment),
		DataCollection: &sentry.DataCollection{
			UserInfo:    sentry.Set(false),
			Cookies:     off,
			HTTPHeaders: &sentry.HeaderCollectionConfig{Request: off, Response: off},
			HTTPBodies:  []sentry.BodyType{},
			QueryParams: off,
		},
	}
}

// environmentName is SENTRY_ENVIRONMENT, else the Vercel environment
// (previews are test deployments), else production.
func environmentName() string {
	if environment := strings.TrimSpace(os.Getenv("SENTRY_ENVIRONMENT")); environment != "" {
		return environment
	}
	switch os.Getenv("VERCEL_ENV") {
	case "preview":
		return "test"
	case "development":
		return "development"
	}
	return defaultEnvironment
}

func tracesSampleRate(environment string) float64 {
	if environment == "development" || environment == "test" {
		return devTracesSampleRate
	}
	return prodTracesSampleRate
}

// tracesSampler keeps every AI request, even when the browser did not sample
// its trace, and follows the browser's decision for everything else.
func tracesSampler(environment string) sentry.TracesSampler {
	rate := tracesSampleRate(environment)
	return func(ctx sentry.SamplingContext) float64 {
		if isAIRequest(ctx.Span.Name) {
			return aiTracesSampleRate
		}
		switch ctx.ParentSampled {
		case sentry.SampledTrue:
			return 1
		case sentry.SampledFalse:
			return 0
		}
		return rate
	}
}

// isAIRequest matches the transaction names of AI generation and evaluation,
// e.g. "POST /api/ai/generate" and "POST /api/sessions/12/evaluate".
func isAIRequest(name string) bool {
	method, path, ok := strings.Cut(name, " ")
	if !ok || method != http.MethodPost {
		return false
	}
	return strings.HasPrefix(path, "/api/ai/generate") ||
		(strings.HasPrefix(path, "/api/sessions/") && strings.HasSuffix(path, "/evaluate"))
}

// releaseName is SENTRY_RELEASE, else the SHA set at build time, else the
// commit Vercel deployed, else the commit Go recorded in the binary.
func releaseName() string {
	if release := strings.TrimSpace(os.Getenv("SENTRY_RELEASE")); release != "" {
		return release
	}
	if buildRelease != "" {
		return buildRelease
	}
	if sha := strings.TrimSpace(os.Getenv("VERCEL_GIT_COMMIT_SHA")); sha != "" {
		return sha
	}
	if info, ok := debug.ReadBuildInfo(); ok {
		for _, setting := range info.Settings {
			if setting.Key == "vcs.revision" {
				return setting.Value
			}
		}
	}
	return ""
}

func initSentry() error {
	options := sentryOptions()
	if options.Dsn == "" {
		return nil
	}
	return sentry.Init(options)
}

func monitorHTTP(next http.Handler) http.Handler {
	if sentry.CurrentHub().Client() == nil {
		return next
	}
	// Keep net/http's existing panic handling and use a separate hub per request.
	return sentryhttp.New(sentryhttp.Options{Repanic: true}).Handle(next)
}
