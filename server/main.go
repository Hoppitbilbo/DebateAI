// DebateAI server: REST API, AI gateway (Gemini, OpenAI-compatible, Anthropic,
// Jev), SQLite storage and the embedded React frontend in one binary.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/httpapi"
	"github.com/Hoppitbilbo/DebateAI/server/webui"
	"github.com/getsentry/sentry-go"
)

func main() {
	if err := initSentry(); err != nil {
		log.Fatalf("sentry: %v", err)
	}
	defer sentry.Flush(sentryFlushTimeout)

	cfg := app.LoadConfig()
	db, err := app.OpenDB(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	// Composition root: repositories and services, then the HTTP server on top.
	services := app.NewServices(cfg, db)
	services.Bootstrap(cfg)
	srv := httpapi.NewServer(cfg, services, webui.FS())
	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           monitorHTTP(srv.Handler()),
		ReadHeaderTimeout: 15 * time.Second,
	}

	go func() {
		log.Printf("DebateAI listening on http://localhost:%s (data: %s)", cfg.Port, cfg.DataDir)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(ctx)
	log.Println("server stopped")
}
