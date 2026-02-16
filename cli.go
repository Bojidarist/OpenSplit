package main

import (
	"flag"
	"fmt"
	"os"
)

// CLIOptions holds the parsed command-line arguments.
type CLIOptions struct {
	Port string
}

// ParseCLI registers all CLI flags, parses them, and handles
// immediate-exit flags like -v/--version. It returns the parsed
// options for use by the caller.
func ParseCLI() CLIOptions {
	var showVersion bool
	flag.BoolVar(&showVersion, "v", false, "Print the version and exit")
	flag.BoolVar(&showVersion, "version", false, "Print the version and exit")

	var opts CLIOptions
	flag.StringVar(&opts.Port, "p", "", "Port to run the server on (e.g. 8080)")
	flag.StringVar(&opts.Port, "port", "", "Port to run the server on (e.g. 8080)")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "OpenSplit %s — A real-time speedrun timer with WebSocket synchronization\n\n", Version)
		fmt.Fprintf(os.Stderr, "Usage:\n  opensplit [flags]\n\n")
		fmt.Fprintf(os.Stderr, "Flags:\n")
		fmt.Fprintf(os.Stderr, "  -v, --version   Print the version and exit\n")
		fmt.Fprintf(os.Stderr, "  -p, --port      Port to run the server on (default %q)\n", DefaultServerPort)
		fmt.Fprintf(os.Stderr, "  -h, --help      Show this help message\n")
		fmt.Fprintf(os.Stderr, "\nThe port can also be set via the PORT environment variable.\n")
		fmt.Fprintf(os.Stderr, "Precedence: --port flag > PORT env var > default (%s)\n", DefaultServerPort)
	}

	flag.Parse()

	if showVersion {
		fmt.Printf("OpenSplit %s\n", Version)
		os.Exit(0)
	}

	return opts
}
