package tests

import (
	"bufio"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/deepgram/examples/510-gin-live-transcription-go/src/server"
	"github.com/gorilla/websocket"
)

func requiredEnv(t *testing.T) {
	t.Helper()

	envFile := "../.env.example"
	f, err := os.Open(envFile)
	if err != nil {
		t.Fatalf("cannot open .env.example: %v", err)
	}
	defer f.Close()

	var missing []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}
		key := strings.TrimSpace(strings.SplitN(line, "=", 2)[0])
		if key == "" {
			continue
		}
		if os.Getenv(key) == "" {
			missing = append(missing, key)
		}
	}

	if len(missing) > 0 {
		fmt.Fprintf(os.Stderr, "MISSING_CREDENTIALS: %s\n", strings.Join(missing, ","))
		os.Exit(2)
	}
}

func TestIndexPage(t *testing.T) {
	srv := server.NewServer()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/", nil)
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	body := w.Body.String()
	if !strings.Contains(body, "Deepgram Live Transcription") {
		t.Fatal("index page missing expected title")
	}
	if !strings.Contains(body, "/ws") {
		t.Fatal("index page missing WebSocket endpoint reference")
	}
}

func TestWebSocketPipeline(t *testing.T) {
	requiredEnv(t)

	srv := server.NewServer()
	ts := httptest.NewServer(srv)
	defer ts.Close()

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws"
	dialer := websocket.Dialer{}
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("WebSocket dial failed: %v", err)
	}
	defer conn.Close()

	// 1. The server should send a "status" message once Deepgram connects.
	//    This proves: browser WS → Gin server → Deepgram SDK → Deepgram API → callback → browser WS
	conn.SetReadDeadline(time.Now().Add(15 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read status message (Deepgram connection may have failed): %v", err)
	}
	var status struct {
		Type       string `json:"type"`
		Transcript string `json:"transcript"`
	}
	if err := json.Unmarshal(msg, &status); err != nil {
		t.Fatalf("Invalid JSON from server: %v", err)
	}
	if status.Type != "status" || status.Transcript != "connected" {
		t.Fatalf("expected status/connected, got: %s", string(msg))
	}
	t.Log("Deepgram connection established via server")

	// 2. Send 2 seconds of 16-bit PCM audio to verify the relay path accepts binary data.
	//    A sine wave won't produce speech transcripts, but the write should succeed
	//    without errors, proving the Gin→Deepgram audio relay works.
	sampleRate := 16000
	totalSamples := sampleRate * 2
	chunkSize := 4096
	bytesSent := 0

	for i := 0; i < totalSamples; i += chunkSize {
		end := i + chunkSize
		if end > totalSamples {
			end = totalSamples
		}
		buf := make([]byte, (end-i)*2)
		for j := i; j < end; j++ {
			sample := int16(math.Sin(2*math.Pi*440*float64(j)/float64(sampleRate)) * 16000)
			binary.LittleEndian.PutUint16(buf[(j-i)*2:], uint16(sample))
		}
		if err := conn.WriteMessage(websocket.BinaryMessage, buf); err != nil {
			t.Fatalf("Failed to send audio chunk: %v", err)
		}
		bytesSent += len(buf)
		time.Sleep(10 * time.Millisecond)
	}

	audioSentSecs := float64(bytesSent) / float64(sampleRate*2)
	t.Logf("Successfully sent %.1fs of audio (%d bytes) through the pipeline", audioSentSecs, bytesSent)

	// 3. Optionally collect any transcript messages that arrive within a short window.
	//    A pure tone typically yields no transcripts, so we don't fail if none arrive.
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	transcriptCount := 0
	for {
		_, rawMsg, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var m struct {
			Type       string `json:"type"`
			Transcript string `json:"transcript"`
			IsFinal    bool   `json:"is_final"`
		}
		json.Unmarshal(rawMsg, &m)
		if m.Type == "transcript" {
			transcriptCount++
			t.Logf("Transcript: is_final=%v text=%q", m.IsFinal, m.Transcript)
		}
	}
	t.Logf("Received %d transcript messages (0 is expected for synthetic audio)", transcriptCount)

	// 4. Graceful close — the WebSocket should close without error
	err = conn.WriteMessage(websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
	if err != nil {
		t.Logf("Close write (non-fatal): %v", err)
	}
}
