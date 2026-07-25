package main

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
)

// handler writes a fixed greeting to the HTTP response.
func handler(res http.ResponseWriter, req *http.Request) {
	fmt.Fprintf(res, "G'day there mate")
}
// routingMiddleware trims a trailing slash from the request URL path before passing the request to h.
func routingMiddleware(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimSuffix(r.URL.Path, "/")
		h.ServeHTTP(w, r)
	})
}

func main() {
	r := mux.NewRouter().StrictSlash(true)
	r.Use(routingMiddleware)

	r.HandleFunc("/api/v1", handler)

	srv := &http.Server{
		Addr:    ":3433",
		Handler: r,
	}
	log.Printf("starting drop server on :3433")
	srv.ListenAndServe()
}
