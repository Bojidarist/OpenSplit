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

## Best Practices

### Go Best Practices

#### Concurrency and Goroutines
- **Use channels for communication**: Prefer channels over shared memory for goroutine communication
- **Always close channels**: Close channels when done to prevent goroutine leaks
- **Handle panics in goroutines**: Use `defer recover()` in long-running goroutines
- **Avoid goroutine leaks**: Ensure all goroutines have a termination condition
- **Use context for cancellation**: Pass `context.Context` for timeout and cancellation support

```go
// Good: Using channels and proper cleanup
func (h *Hub) run() {
    defer func() {
        if r := recover(); r != nil {
            log.Printf("Hub recovered from panic: %v", r)
        }
    }()
    
    for {
        select {
        case client := <-h.register:
            h.clients[client] = true
        case client := <-h.unregister:
            if _, ok := h.clients[client]; ok {
                delete(h.clients, client)
                close(client.send)
            }
        }
    }
}
```

#### Memory Management
- **Use sync.Pool for frequently allocated objects**: Reduce GC pressure
- **Avoid unnecessary allocations**: Reuse slices and maps where appropriate
- **Profile before optimizing**: Use `pprof` to identify actual bottlenecks
- **Use buffered channels wisely**: Size buffers based on expected load

#### Error Handling
- **Return errors, don't panic**: Reserve panics for truly unrecoverable situations
- **Wrap errors with context**: Use `fmt.Errorf("context: %w", err)` for error chains
- **Check all errors**: Never ignore error return values
- **Log errors at appropriate levels**: Debug, Info, Warning, Error, Fatal

```go
// Good: Proper error handling
func (ts *TimerState) Split(splitName string) error {
    if ts.Status != "running" {
        return fmt.Errorf("cannot split: timer is %s, expected running", ts.Status)
    }
    
    currentTime := ts.CurrentTime
    split := Split{
        Name:     splitName,
        Duration: currentTime,
    }
    ts.Splits = append(ts.Splits, split)
    return nil
}
```

#### Testing Best Practices
- **Table-driven tests**: Use test tables for multiple test cases
- **Test edge cases**: Empty inputs, nil values, boundary conditions
- **Use subtests**: Organize tests with `t.Run()` for better output
- **Mock external dependencies**: Use interfaces for testability
- **Test concurrency**: Use `go test -race` to detect race conditions

```go
func TestTimerSplit(t *testing.T) {
    tests := []struct {
        name        string
        status      string
        splitName   string
        expectError bool
    }{
        {"valid split", "running", "Level 1", false},
        {"stopped timer", "stopped", "Level 1", true},
        {"paused timer", "paused", "Level 1", true},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ts := &TimerState{Status: tt.status}
            err := ts.Split(tt.splitName)
            if (err != nil) != tt.expectError {
                t.Errorf("Split() error = %v, expectError %v", err, tt.expectError)
            }
        })
    }
}
```

### WebSocket Best Practices

#### Connection Management
- **Implement heartbeat/ping-pong**: Detect dead connections early
- **Set read/write deadlines**: Prevent goroutines from blocking forever
- **Handle disconnections gracefully**: Clean up resources and allow reconnection
- **Rate limit messages**: Prevent abuse and resource exhaustion
- **Validate incoming messages**: Never trust client input

```go
// Good: Proper WebSocket setup with timeouts
const (
    writeWait = 10 * time.Second
    pongWait = 60 * time.Second
    pingPeriod = (pongWait * 9) / 10
)

func (c *Client) writePump() {
    ticker := time.NewTicker(pingPeriod)
    defer ticker.Stop()
    
    for {
        select {
        case message := <-c.send:
            c.conn.SetWriteDeadline(time.Now().Add(writeWait))
            if err := c.conn.WriteJSON(message); err != nil {
                return
            }
        case <-ticker.C:
            c.conn.SetWriteDeadline(time.Now().Add(writeWait))
            if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return
            }
        }
    }
}
```

#### State Synchronization
- **Broadcast state changes**: Keep all clients synchronized
- **Send full state on connect**: New clients get current state immediately
- **Use atomic operations**: For shared counters and flags
- **Version your messages**: Allow protocol evolution without breaking changes
- **Handle partial updates**: Minimize bandwidth with incremental updates when appropriate

#### Security Considerations
- **Validate origin**: Check Origin header to prevent CSRF
- **Use authentication**: Implement token-based auth for sensitive operations
- **Sanitize inputs**: Prevent injection attacks and malformed data
- **Limit message size**: Prevent memory exhaustion attacks
- **Use TLS in production**: Always use WSS (WebSocket Secure) in production

### Performance Best Practices

#### Backend Optimization
- **Minimize allocations in hot paths**: Reuse objects, avoid repeated allocations
- **Use benchmarks**: Write and run benchmarks for critical code
- **Batch operations**: Group database writes, reduce network roundtrips
- **Use appropriate data structures**: Maps for lookups, slices for iteration

```bash
# Run benchmarks
go test -bench=. -benchmem

# Profile CPU usage
go test -cpuprofile=cpu.prof -bench=.
```

#### Frontend Optimization
- **Debounce user input**: Reduce unnecessary WebSocket messages
- **Update DOM efficiently**: Batch updates, use DocumentFragment
- **Lazy render off-screen content**: Only render visible splits
- **Cache DOM queries**: Store element references
- **Use CSS transitions**: Offload animations to GPU

```javascript
// Good: Debounced input handling
let updateTimer;
function handleInput(value) {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
        ws.send(JSON.stringify({ command: "update", value }));
    }, 300);
}
```

### Code Organization Best Practices

#### Project Structure
- **Keep packages focused**: Each package should have a single responsibility
- **Avoid circular dependencies**: Structure imports hierarchically
- **Use internal packages**: Prevent external imports of internal APIs
- **Separate concerns**: Business logic, networking, and presentation layers
- **Group related files**: `*_test.go` beside implementation files

#### Documentation
- **Write package documentation**: Start each package with a doc comment
- **Document exported APIs**: Every exported function, type, method needs comments
- **Include examples**: Use `Example` tests for documentation
- **Maintain AGENTS.md**: Keep this file updated with architectural changes
- **Use meaningful commit messages**: Follow conventional commits format

```go
// Package timer provides real-time speedrun timing functionality.
// It manages timer state, splits, and WebSocket-based synchronization
// across multiple connected clients.
package timer

// Start begins timer execution, setting the status to "running" and
// recording the start time. Returns an error if the timer is already
// running.
func (ts *TimerState) Start() error {
    // Implementation
}
```

#### Code Maintainability
- **DRY (Don't Repeat Yourself)**: Extract common logic into functions
- **KISS (Keep It Simple)**: Prefer simple solutions over clever ones
- **YAGNI (You Aren't Gonna Need It)**: Don't add features speculatively
- **Refactor incrementally**: Small, continuous improvements over big rewrites
- **Delete dead code**: Remove unused functions, commented-out code

### Development Best Practices

#### Debugging
- **Use structured logging**: Include context (client ID, command type, etc.)
- **Check logs first**: Review server.log before adding print statements
- **Reproduce systematically**: Create minimal test cases

```bash
# View recent logs
tail -n 100 server.log

# Watch logs in real-time
tail -f server.log | grep ERROR
```

#### WebSocket Pitfalls
- **Not handling partial messages**: WebSocket frames may be fragmented
- **Sending to closed connections**: Check client map before sending
- **Blocking on send**: Use buffered channels and timeouts
- **Missing connection cleanup**: Always defer conn.Close()
- **Ignoring message order**: WebSocket guarantees order, maintain it

#### General Pitfalls
- **Premature optimization**: Profile first, optimize bottlenecks
- **Over-engineering**: Start simple, add complexity only when needed
- **Skipping tests**: Tests save time in the long run
- **Hardcoding values**: Use constants and configuration
- **Ignoring errors**: Every error is an opportunity to handle failures gracefully

Follow these guidelines to maintain consistency and quality in the OpenSplit codebase.
