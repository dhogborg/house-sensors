package main

import (
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"

	"github.com/go-chi/chi"
)

type InfluxHandler struct{}

func NewInfluxHandler() *InfluxHandler {
	return &InfluxHandler{}
}

func (h *InfluxHandler) HandleRoutes(r chi.Router) {
	r.Get("/test*", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "test")
	})
	r.Handle("/*", h.Proxy())
}

func (h *InfluxHandler) Proxy() http.HandlerFunc {
	influxURL := os.Getenv("INFLUX_URL")
	if influxURL == "" {
		slog.Error("invalid Influx URL", "url", influxURL)
	}

	url, err := url.Parse(influxURL)
	if err != nil {
		slog.Error("unable to parse target host", "error", err)
	}

	proxy := httputil.NewSingleHostReverseProxy(url)
	if err != nil {
		slog.Error("unable to create reverse proxy", "error", err)
	}

	return func(w http.ResponseWriter, r *http.Request) {
		// fmt.Printf("%s: %s\n", r.Method, r.URL)
		// fmt.Printf("%s header: %s\n", r.Method, r.Header.Get("Access-Control-Allow-Origin"))
		// This workaround is based on this configuration: https://enable-cors.org/server_nginx.html
		if r.Method == "OPTIONS" {
			w.Header().Add("Access-Control-Allow-Origin", "*")
			w.Header().Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Add("Access-Control-Allow-Headers", "*")
			w.Header().Add("Access-Control-Max-Age", "1728000")
			w.Header().Add("Content-Type", "text/plain; charset=utf-8")
			w.Header().Add("Content-Length", "0")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		if r.Method == "POST" {
			// This header is deliberately omitted since the influx server also sets it on response
			// 	w.Header().Add("Access-Control-Allow-Origin", "*")
			w.Header().Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Add("Access-Control-Allow-Headers", "*")
			w.Header().Add("Access-Control-Expose-Headers", "Content-Length,Content-Range")
		}
		if r.Method == "GET" {
			w.Header().Add("Access-Control-Allow-Origin", "*")
			w.Header().Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Add("Access-Control-Allow-Headers", "*")
			w.Header().Add("Access-Control-Expose-Headers", "Content-Length,Content-Range")
		}

		path := r.URL.Path
		r.URL.Path = strings.Replace(path, "/api/influxdb", "", 1)

		r.Header.Set("Authorization", "Token "+os.Getenv("INFLUXDB_TOKEN"))

		proxy.ServeHTTP(w, r)
	}
}
