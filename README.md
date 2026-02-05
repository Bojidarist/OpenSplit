# OpenSplit

A web-based speedrun timer application with real-time synchronization across multiple devices on the same network.

## Features

- Start, pause, reset, and next split controls
- Splits management
- Real-time sync via WebSockets
- Export and import splits in JSON format

## Build from source

1. Ensure you have Go installed (version 1.16+).
2. Clone or download the project and navigate to the directory.
3. Install dependencies:
    ```
    go mod tidy
    ```
4. Build
    ```
    go build -ldflags "-s -w" -trimpath -o build/opensplit
    ```
5. Run
    ```
    ./build/opensplit
    ```

The server runs on port 8080. Open `http://localhost:8080` in your browser. For multi-device access, use the server's IP address (can be configured from settings menu).
