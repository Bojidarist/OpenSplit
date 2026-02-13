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

// Run runs the hub
func (h *Hub) Run() {
	ticker := time.NewTicker(100 * time.Millisecond)
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
			// Parse message and update timer state
			var cmd map[string]interface{}
			if err := json.Unmarshal(message, &cmd); err != nil {
				log.Println("Invalid message:", err)
				continue
			}

			switch cmd["command"] {
			case "start":
				h.timer.Start()
			case "pause":
				h.timer.Pause()
			case "reset":
				h.timer.Reset()
			case "setSplits":
				if splits, ok := cmd["splits"].([]interface{}); ok {
					var splitDefs []SplitDefinition
					for _, s := range splits {
						if splitMap, ok := s.(map[string]interface{}); ok {
							name := ""
							icon := "🏃"
							if n, ok := splitMap["name"].(string); ok {
								name = n
							}
							if i, ok := splitMap["icon"].(string); ok {
								icon = i
							}
							splitDefs = append(splitDefs, SplitDefinition{
								Name: name,
								Icon: icon,
							})
						}
					}
					title := "OpenSplit"
					if t, ok := cmd["title"].(string); ok {
						title = t
					}
					h.timer.SetPredefinedSplits(splitDefs, title)
				}
			case "nextSplit":
				h.timer.NextSplit()
			case "restorePBData":
				h.timer.RestorePBData(cmd)
			case "setWorldRecord":
				if worldRecord, ok := cmd["worldRecord"].(float64); ok {
					h.timer.WorldRecord = time.Duration(worldRecord)
				}
			}

			// Broadcast updated state to all clients
			for client := range h.clients {
				select {
				case client.send <- h.timer.ToJSON():
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}

		case <-ticker.C:
			h.timer.Update()
			// Send periodic updates if running
			if h.timer.Status == "running" {
				for client := range h.clients {
					select {
					case client.send <- h.timer.ToJSON():
					default:
						close(client.send)
						delete(h.clients, client)
					}
				}
			}
		}
	}
}
