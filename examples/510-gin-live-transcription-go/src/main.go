package main

import (
	"fmt"
	"log"
	"os"

	"github.com/deepgram/examples/510-gin-live-transcription-go/src/server"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	r := server.NewServer()
	fmt.Printf("Server running on http://localhost:%s\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed: %v\n", err)
	}
}
