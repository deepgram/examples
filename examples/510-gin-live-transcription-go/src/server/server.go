package server

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	api "github.com/deepgram/deepgram-go-sdk/v3/pkg/api/listen/v1/websocket/interfaces"
	interfaces "github.com/deepgram/deepgram-go-sdk/v3/pkg/client/interfaces"
	listen "github.com/deepgram/deepgram-go-sdk/v3/pkg/client/listen"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type TranscriptMessage struct {
	Type       string `json:"type"`
	Transcript string `json:"transcript"`
	IsFinal    bool   `json:"is_final"`
}

type DeepgramCallback struct {
	mu        sync.Mutex
	browserWS *websocket.Conn
}

func (cb *DeepgramCallback) sendJSON(msg TranscriptMessage) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	data, _ := json.Marshal(msg)
	_ = cb.browserWS.WriteMessage(websocket.TextMessage, data)
}

func (cb *DeepgramCallback) Open(_ *api.OpenResponse) error {
	log.Println("Deepgram connection opened")
	cb.sendJSON(TranscriptMessage{Type: "status", Transcript: "connected"})
	return nil
}

func (cb *DeepgramCallback) Message(mr *api.MessageResponse) error {
	if len(mr.Channel.Alternatives) == 0 {
		return nil
	}
	transcript := strings.TrimSpace(mr.Channel.Alternatives[0].Transcript)
	if transcript == "" {
		return nil
	}
	cb.sendJSON(TranscriptMessage{
		Type:       "transcript",
		Transcript: transcript,
		IsFinal:    mr.IsFinal,
	})
	return nil
}

func (cb *DeepgramCallback) Metadata(_ *api.MetadataResponse) error         { return nil }
func (cb *DeepgramCallback) SpeechStarted(_ *api.SpeechStartedResponse) error { return nil }
func (cb *DeepgramCallback) UtteranceEnd(_ *api.UtteranceEndResponse) error   { return nil }

func (cb *DeepgramCallback) Close(_ *api.CloseResponse) error {
	log.Println("Deepgram connection closed")
	return nil
}

func (cb *DeepgramCallback) Error(er *api.ErrorResponse) error {
	log.Printf("Deepgram error: %s — %s\n", er.ErrCode, er.Description)
	return nil
}

func (cb *DeepgramCallback) UnhandledEvent(byData []byte) error {
	log.Printf("Deepgram unhandled event: %s\n", string(byData))
	return nil
}

func NewServer() *gin.Engine {
	r := gin.Default()

	r.GET("/", func(c *gin.Context) {
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.String(http.StatusOK, IndexHTML)
	})

	r.GET("/ws", handleWebSocket)
	return r
}

func handleWebSocket(c *gin.Context) {
	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v\n", err)
		return
	}
	defer conn.Close()

	apiKey := os.Getenv("DEEPGRAM_API_KEY")
	if apiKey == "" {
		_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"error","transcript":"DEEPGRAM_API_KEY not set"}`))
		return
	}

	listen.InitWithDefault()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	callback := &DeepgramCallback{browserWS: conn}

	// tag: "deepgram-examples" ← REQUIRED tag for Deepgram internal traffic tracking
	tOptions := &interfaces.LiveTranscriptionOptions{
		Model:          "nova-3",
		Language:       "en-US",
		SmartFormat:    true,
		InterimResults: true,
		VadEvents:      true,
		UtteranceEndMs: "1000",
		Encoding:       "linear16",
		SampleRate:     16000,
		Channels:       1,
		Tag:            []string{"deepgram-examples"},
	}

	cOptions := &interfaces.ClientOptions{
		EnableKeepAlive: true,
	}

	dgClient, err := listen.NewWSUsingCallback(ctx, apiKey, cOptions, tOptions, callback)
	if err != nil {
		log.Printf("Failed to create Deepgram client: %v\n", err)
		return
	}

	connected := dgClient.Connect()
	if !connected {
		log.Println("Failed to connect to Deepgram")
		return
	}
	defer dgClient.Stop()

	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			break
		}
		if msgType == websocket.BinaryMessage {
			_, writeErr := dgClient.Write(data)
			if writeErr != nil {
				log.Printf("Failed to send audio to Deepgram: %v\n", writeErr)
				break
			}
		}
	}
}
