package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"golang.ngrok.com/ngrok"
	ngrokConf "golang.ngrok.com/ngrok/config"
)

func Start(h http.Handler) {
	go func() {
		if os.Getenv("NGROK_AUTHTOKEN") != "" {
			if err := listenNgrok(h); err != nil {
				log.Fatal(err)
			}
		}
	}()

	go func() {
		listenLocal(h)
	}()

	// create a context which listening to SIGTERM, SIGINT
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	<-ctx.Done()
}

func listenNgrok(h http.Handler) error {
	domain := os.Getenv("NGROK_TUNNEL_DOMAIN")

	tun, err := ngrok.Listen(context.Background(),
		ngrokConf.HTTPEndpoint(
			ngrokConf.WithDomain(domain),
		),
		ngrok.WithAuthtokenFromEnv(),
		ngrok.WithRegion("eu"),
	)
	if err != nil {
		return err
	}

	slog.Info("tunnel created:", "url", tun.URL())

	return http.Serve(tun, NewHttpAuthMiddleware(h))
}

func listenLocal(h http.Handler) {
	slog.Info("Listening to :8080", "url", "http://localhost:8080")
	http.ListenAndServe(":8080", h)
}
