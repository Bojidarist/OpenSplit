package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
)

//go:embed static/*
var staticFS embed.FS

func main() {
	opts := ParseCLI()

	hub := NewHub()
	go hub.Run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ServeWs(hub, w, r)
	})

	staticSub, _ := fs.Sub(staticFS, "static")
	http.Handle("/", http.FileServer(http.FS(staticSub)))

	port := GetServerPort(opts.Port)
	log.Printf("Server starting on %s", port)
	log.Fatal(http.ListenAndServe(port, nil))
}
