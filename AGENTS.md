# AGENTS.md - OpenSplit Development Guidelines

This document provides guidelines for agentic coding assistants working on the OpenSplit codebase. OpenSplit is a Go-based web application for speedrun timing with real-time WebSocket synchronization.

## Build/Test/Lint Commands

### Building and Running
```bash
# Build the application
go build -o ./build/opensplit

# Run the application locally (starts server on :8080)
go run .
```

### Testing
```bash
# Run all tests
go test ./...

# Run a specific test function
go test -run TestSpecificFunction

# Run tests with coverage
go test -cover ./...
```

### Code Quality Checks
```bash
# Format Go code (run before committing)
go fmt ./...

# Run basic static analysis
go vet ./...

# Check for unused dependencies
go mod tidy
```

### Single Test Execution
When working on a specific feature, run individual tests:
```bash
go test -run TestTimer
go test -race -run TestConcurrentFeature
```

## Code Style Guidelines

### Go Language Conventions

#### Naming
- **Exported functions/types**: Start with capital letters (e.g., `NewHub`, `ServeWs`)
- **Unexported items**: Start with lowercase (e.g., `newHub`)
- **Variables**: camelCase, descriptive names (e.g., `currentSplitIndex`)

#### Imports
- Standard library first, third-party second
- Blank line between groups

```go
import (
    "encoding/json"
    "log"
    "net/http"
    "time"

    "github.com/gorilla/websocket"
)
```

#### Structs and Types
- Use meaningful names, group related fields
- Add JSON tags with snake_case

```go
type TimerState struct {
    CurrentTime       time.Duration `json:"current_time"`
    Status            string        `json:"status"`
    Splits            []Split       `json:"splits"`
    PredefinedSplits  []string      `json:"predefined_splits"`
    CurrentSplitIndex int           `json:"current_split_index"`
}
```

#### Functions
- Document exported functions with comments
- Use abbreviated receiver names (e.g., `h *Hub`, `ts *TimerState`)
- Keep functions focused on single responsibilities

#### Error Handling
- Always check for errors from function calls
- Log errors appropriately, don't silently ignore

#### Comments
- Document all exported functions, types, and methods
- Use `//` for single-line comments
- Explain complex logic

### WebSocket and Real-time Features

#### Message Format
- JSON objects with "command" field
- Include additional data as needed

```javascript
// Client commands:
{ "command": "start" }
{ "command": "setSplits", "splits": ["Level 1", "Level 2"] }

// Server state updates:
{
    "current_time": 1500000000,
    "status": "running",
    "splits": [...],
    "predefined_splits": [...],
    "current_split_index": 0
}
```

#### Client Management
- Register new clients immediately upon connection
- Unregister clients when connection closes
- Use buffered channels for message passing

#### Timer State Management
- Centralize logic in TimerState struct
- Use clear status values: "stopped", "running", "paused"
- Handle time calculations carefully

### Frontend JavaScript

#### Code Organization
- Use `let` and `const` appropriately
- Descriptive variable names (e.g., `serverIP`, `visibleSplits`)
- Handle WebSocket lifecycle properly

#### Event Handling
- Connect to WebSocket on page load
- Implement reconnection logic
- Parse JSON messages and update UI

```javascript
function connectWS() {
    ws = new WebSocket(`ws://${serverIP}/ws`);
    ws.onopen = () => console.log('Connected to timer server');
    ws.onmessage = (event) => updateTimer(JSON.parse(event.data));
    ws.onclose = () => setTimeout(connectWS, 1000);
}
```

### Development Workflow

#### Local Development
1. Run `go run .` to start the server
2. Open `http://localhost:8080` in browser
3. Test WebSocket functionality across multiple tabs/devices

#### Server Logging
- Server logs are written to `server.log` in the current directory
- Use `cat server.log` to view current logs or `tail -f server.log` to monitor in real-time
- Check server logs when debugging WebSocket connections or server errors

#### Adding New Features
1. For timer features: Modify TimerState methods and hub command handling
2. For UI features: Update HTML, CSS, and JavaScript in static/ directory
3. For new WebSocket commands: Add to hub's switch statement and client sendCommand

#### Testing Strategy
- Write unit tests for TimerState methods
- Test WebSocket message parsing and state updates
- Verify timer accuracy and split calculations
- Use `go test` for automated testing

#### Code Review Checklist
- [ ] Code formatted with `go fmt`
- [ ] `go vet` passes
- [ ] Exported functions documented
- [ ] Error handling implemented
- [ ] WebSocket messages formatted correctly
- [ ] Tests added for new functionality

### Project Architecture Notes

- **Hub**: Central coordinator for WebSocket clients and timer state
- **Client**: Manages individual WebSocket connections
- **TimerState**: Pure data structure with timer operations
- **Frontend**: Vanilla JavaScript with minimal dependencies

Follow these guidelines to maintain consistency and quality in the OpenSplit codebase.
