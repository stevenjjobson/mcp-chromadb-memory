#!/bin/bash
# Wrapper script for MCP server to ensure environment variables are set

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: OPENAI_API_KEY environment variable is not set" >&2
    echo "Please set it using: export OPENAI_API_KEY='your-api-key'" >&2
    exit 1
fi

# Run the Node.js MCP server
exec node dist/index.js "$@"