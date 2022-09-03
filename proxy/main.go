package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
)

func main() {
	targetHost := os.Getenv("TARGET")
	if targetHost == "" {
		panic("invalid target")
	}

	url, err := url.Parse(targetHost)
	if err != nil {
		panic(err.Error())
	}

	proxy := httputil.NewSingleHostReverseProxy(url)
	if err != nil {
		panic(err)
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
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

		w.Header().Add("Authorization", r.Header.Get("Authorization"))

		proxy.ServeHTTP(w, r)
	})
	log.Fatal(http.ListenAndServe(":9086", nil))
}
