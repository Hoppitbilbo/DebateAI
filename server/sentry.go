package main

import (
	"net/http"
	"os"
	"runtime/debug"
	"strings"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
)

// Set by release builds; both the browser and API use the same commit SHA.
var buildRelease string

func sentryOptions() sentry.ClientOptions {
	environment := strings.TrimSpace(os.Getenv("SENTRY_ENVIRONMENT"))
	if environment == "" {
		environment = "production"
	}
	rate := 0.1
	if environment == "development" || environment == "test" {
		rate = 1
	}
	release := strings.TrimSpace(os.Getenv("SENTRY_RELEASE"))
	if release == "" {
		release = buildRelease
	}
	if release == "" {
		if info, ok := debug.ReadBuildInfo(); ok {
			for _, setting := range info.Settings {
				if setting.Key == "vcs.revision" {
					release = setting.Value
				}
			}
		}
	}
	off := &sentry.KeyValueCollectionBehavior{Mode: sentry.CollectionOff}
	return sentry.ClientOptions{
		Dsn:              strings.TrimSpace(os.Getenv("SENTRY_DSN")),
		Environment:      environment,
		Release:          release,
		AttachStacktrace: true,
		EnableTracing:    true,
		TracesSampleRate: rate,
		DataCollection: &sentry.DataCollection{
			UserInfo:    sentry.Set(false),
			Cookies:     off,
			HTTPHeaders: &sentry.HeaderCollectionConfig{Request: off, Response: off},
			HTTPBodies:  []sentry.BodyType{},
			QueryParams: off,
		},
	}
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
