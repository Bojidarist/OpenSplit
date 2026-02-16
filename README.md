# OpenSplit

A web-based speedrun timer application with real-time synchronization across multiple devices on the same network.

## Features

- Start, pause, reset, and next split controls
- Splits management
- Real-time sync via WebSockets
- Export and import splits in JSON format

## Installation

1. Go to [releases](https://github.com/Bojidarist/OpenSplit/releases) and download the latest version for your platform.
2. Extract the archive.
3. Run the binary, this will run the server.

    The server runs on port 8080. Open `http://localhost:8080` in your browser. For multi-device access, use the server's IP address (can be configured from settings menu).

## Build from source

1. Ensure you have Go installed (version 1.16+).
2. Clone or download the project and navigate to the directory.
3. Build
    ```
    # Current OS
    make build

    # Windows
    make build-windows

    # Linux
    make build-linux

    # Specify version
    make build VERSION=1.0.0
    ```
