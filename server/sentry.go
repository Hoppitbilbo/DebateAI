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
	// sentryFlushTimeout is how long shutdown waits for queued events.
	sentryFlushTimeout = 2 * time.Second
)

func sentryOptions() sentry.ClientOptions {
	environment := strings.TrimSpace(os.Getenv("SENTRY_ENVIRONMENT"))
	if environment == "" {
		environment = defaultEnvironment
	}
	off := &sentry.KeyValueCollectionBehavior{Mode: sentry.CollectionOff}
	return sentry.ClientOptions{
		Dsn:              strings.TrimSpace(os.Getenv("SENTRY_DSN")),
		Environment:      environment,
		Release:          releaseName(),
		AttachStacktrace: true,
		EnableTracing:    true,
		TracesSampleRate: tracesSampleRate(environment),
		DataCollection: &sentry.DataCollection{
			UserInfo:    sentry.Set(false),
			Cookies:     off,
			HTTPHeaders: &sentry.HeaderCollectionConfig{Request: off, Response: off},
			HTTPBodies:  []sentry.BodyType{},
			QueryParams: off,
		},
	}
}

func tracesSampleRate(environment string) float64 {
	if environment == "development" || environment == "test" {
		return devTracesSampleRate
	}
	return prodTracesSampleRate
}

// releaseName is SENTRY_RELEASE, else the SHA set at build time, else the
// commit Go recorded in the binary.
func releaseName() string {
	if release := strings.TrimSpace(os.Getenv("SENTRY_RELEASE")); release != "" {
		return release
	}
	if buildRelease != "" {
		return buildRelease
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
