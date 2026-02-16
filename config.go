package main

import (
	"os"
	"time"
)

const (
	// DefaultServerPort is the default HTTP server port.
	DefaultServerPort = ":8080"

	// DefaultTimerTitle is the default title shown in the timer UI.
	DefaultTimerTitle = "OpenSplit"

	// DefaultSplitIcon is the default emoji icon for splits.
	DefaultSplitIcon = "🏃"

	// TimerTickInterval is how often the timer state is broadcast to clients while running.
	TimerTickInterval = 100 * time.Millisecond

	// WriteWait is the time allowed to write a message to the peer.
	WriteWait = 10 * time.Second

	// PongWait is the time allowed to read the next pong message from the peer.
	PongWait = 60 * time.Second

	// PingPeriod is how often pings are sent. Must be less than PongWait.
	PingPeriod = (PongWait * 9) / 10

	// MaxMessageSize is the maximum message size allowed from peer (10MB to support base64 images).
	MaxMessageSize = 10 * 1024 * 1024

	// WSReadBufferSize is the WebSocket read buffer size (1MB).
	WSReadBufferSize = 1024 * 1024

	// WSWriteBufferSize is the WebSocket write buffer size (1MB).
	WSWriteBufferSize = 1024 * 1024

	// ClientSendBufferSize is the buffer size for the client's outbound message channel.
	ClientSendBufferSize = 256
)

// GetServerPort returns the server port, checking the PORT environment variable first.
func GetServerPort() string {
	if port := os.Getenv("PORT"); port != "" {
		if port[0] != ':' {
			return ":" + port
		}
		return port
	}
	return DefaultServerPort
}
