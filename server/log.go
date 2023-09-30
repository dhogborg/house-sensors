package main

import (
	"log/slog"
	"os"

	"github.com/golang-cz/devslog"
)

var w = os.Stdout

var logger = slog.New(devslog.NewHandler(w, nil))

func init() {
	// set global logger
	slog.SetDefault(logger)
}
