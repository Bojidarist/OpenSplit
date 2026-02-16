package main

import (
	"encoding/json"
	"log"
	"time"
)

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	// Registered clients.
	clients map[*Client]bool

	// Inbound messages from the clients.
	broadcast chan []byte

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	// Timer state
	timer *TimerState
}

// NewHub creates a new hub
func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		timer:      NewTimerState(),
	}
}

// broadcastState sends the current timer state to all connected clients.
// Clients that fail to receive are disconnected.
func (h *Hub) broadcastState() {
	state := h.timer.ToJSON()
	for client := range h.clients {
		select {
		case client.send <- state:
		default:
			close(client.send)
			delete(h.clients, client)
		}
	}
}

// handleCommand processes an incoming command from a client and mutates timer state.
func (h *Hub) handleCommand(cmd map[string]interface{}) {
	switch cmd["command"] {
	case "start":
		h.timer.Start()
	case "pause":
		h.timer.Pause()
	case "reset":
		h.timer.Reset()
	case "setSplits":
		h.handleSetSplits(cmd)
	case "nextSplit":
		h.timer.NextSplit()
	case "restorePBData":
		h.timer.RestorePBData(cmd)
	case "setWorldRecord":
		if worldRecord, ok := cmd["worldRecord"].(float64); ok {
			h.timer.WorldRecord = time.Duration(worldRecord)
		}
	}
}

// handleSetSplits parses split definitions from a setSplits command and applies them.
func (h *Hub) handleSetSplits(cmd map[string]interface{}) {
	splits, ok := cmd["splits"].([]interface{})
	if !ok {
		return
	}

	splitDefs := parseSplitDefinitions(splits)

	title := DefaultTimerTitle
	if t, ok := cmd["title"].(string); ok {
		title = t
	}

	h.timer.SetPredefinedSplits(splitDefs, title)
}

// parseSplitDefinitions converts raw JSON split data into typed SplitDefinition structs.
func parseSplitDefinitions(splits []interface{}) []SplitDefinition {
	var splitDefs []SplitDefinition
	for _, s := range splits {
		splitMap, ok := s.(map[string]interface{})
		if !ok {
			continue
		}

		name := ""
		icon := DefaultSplitIcon
		notes := ""

		if n, ok := splitMap["name"].(string); ok {
			name = n
		}
		if i, ok := splitMap["icon"].(string); ok {
			icon = i
		}
		if nt, ok := splitMap["notes"].(string); ok {
			notes = nt
		}

		splitDefs = append(splitDefs, SplitDefinition{
			Name:  name,
			Icon:  icon,
			Notes: notes,
		})
	}
	return splitDefs
}

// Run runs the hub's main event loop.
func (h *Hub) Run() {
	ticker := time.NewTicker(TimerTickInterval)
	defer ticker.Stop()

	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			// Send current state to new client
			client.send <- h.timer.ToJSON()

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}

		case message := <-h.broadcast:
			var cmd map[string]interface{}
			if err := json.Unmarshal(message, &cmd); err != nil {
				log.Println("Invalid message:", err)
				continue
			}

			h.handleCommand(cmd)
			h.broadcastState()

		case <-ticker.C:
			h.timer.Update()
			if h.timer.Status == "running" {
				h.broadcastState()
			}
		}
	}
}
