package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/chi"
	"github.com/go-chi/chi/middleware"
)

type LocalHandler interface {
	HandleRoutes(chi.Router)
}

func Router() http.Handler {
	// Setup router
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	r.Route("/api", func(r chi.Router) {
		r.Route("/influxdb", NewInfluxHandler().HandleRoutes)
		r.Route("/mqtt", NewMQTTHandler().HandleRoutes)
	})

	path := os.Getenv("STATIC_ASSETS")
	fs := http.FileServer(http.Dir(path))
	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		fs.ServeHTTP(w, r)
	})

	slog.Info("serving static assets from", "path", path)

	return r
}
