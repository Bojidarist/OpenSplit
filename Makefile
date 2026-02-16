VERSION ?= dev
BINARY  := opensplit
BUILD   := build
LDFLAGS := -s -w -X main.Version=$(VERSION)

.PHONY: all build build-windows build-linux run clean fmt vet test check

## all: format, vet, test, then build for the current platform
all: check build

## build: compile for the current OS/arch
build:
	go build -ldflags "$(LDFLAGS)" -trimpath -o $(BUILD)/$(BINARY)

## build-windows: cross-compile for Windows amd64
build-windows:
	GOOS=windows GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -trimpath -o $(BUILD)/$(BINARY).exe

## build-linux: cross-compile for Linux amd64
build-linux:
	GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -trimpath -o $(BUILD)/$(BINARY)

## run: build and run the server
run: build
	./$(BUILD)/$(BINARY)

## clean: remove build artifacts
clean:
	rm -rf $(BUILD)

## fmt: format all Go source files
fmt:
	go fmt ./...

## vet: run static analysis
vet:
	go vet ./...

## test: run all tests
test:
	go test ./...

## check: fmt + vet + test
check: fmt vet test
