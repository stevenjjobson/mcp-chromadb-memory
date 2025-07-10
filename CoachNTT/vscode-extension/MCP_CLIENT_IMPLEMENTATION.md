# MCP Client Implementation Guide

This document describes the MCP (Model Context Protocol) client implementation in the CoachNTT VSCode extension.

## Architecture Overview

The MCP client implementation follows a layered architecture:

```
┌─────────────────────────────────────────┐
│         VSCode Extension                 │
│  ┌───────────────────────────────────┐  │
│  │     Extension Entry Point          │  │
│  │      (extension.ts)                │  │
│  └──────────────┬────────────────────┘  │
│                 │                        │
│  ┌──────────────▼────────────────────┐  │
│  │    Connection Manager              │  │
│  │ (connection-manager.ts)            │  │
│  └──────────────┬────────────────────┘  │
│                 │                        │
│  ┌──────────────▼────────────────────┐  │
│  │      MCP Client Service           │  │
│  │     (mcp-client.ts)               │  │
│  └──────────────┬────────────────────┘  │
└─────────────────┼────────────────────────┘
                  │
                  │ stdio
                  │
┌─────────────────▼────────────────────────┐
│         MCP Server Process               │
│    (Node.js or Docker container)         │
└──────────────────────────────────────────┘
```

## Key Components

### 1. MCP Client Service (`src/services/mcp-client.ts`)

The core MCP client that handles:
- Connection management via `StdioClientTransport`
- Tool invocation through the MCP protocol
- Status bar updates for connection state
- Error handling and logging

**Key Methods:**
- `connect(config)` - Establishes connection to MCP server
- `disconnect()` - Cleanly closes the connection
- `callTool(name, args)` - Invokes MCP tools
- Memory tool wrappers (storeMemory, recallMemories, etc.)
- Audio tool wrappers (synthesizeAudio, getAvailableVoices, etc.)

### 2. Connection Manager (`src/services/connection-manager.ts`)

Handles configuration and connection lifecycle:
- Detects available server types (local, Docker, remote)
- Manages environment variables and API keys
- Provides UI for configuration
- Auto-connection on startup

**Server Types:**
1. **Local**: Runs MCP server from local Node.js files
2. **Docker**: Runs MCP server in Docker container
3. **Remote**: Connects to remote MCP server (future)

### 3. Memory Provider (`src/providers/memory-provider.ts`)

Tree view provider for displaying memories:
- Shows tier hierarchy (Working, Session, Long-term)
- Fetches and caches memory data
- Auto-refresh capability
- Rich tooltips with memory details

### 4. Audio Controller (`src/services/audio-controller.ts`)

Manages audio synthesis and playback:
- Queue management
- Status bar controls
- Voice selection
- Playback state management

## Communication Pattern

The MCP client uses stdio (standard input/output) for communication:

1. **Client spawns server process** with configured command and args
2. **JSON-RPC messages** are exchanged via stdio
3. **Bidirectional communication** allows for:
   - Client → Server: Tool calls, queries
   - Server → Client: Results, notifications

## Configuration

VSCode settings control the MCP client behavior:

```json
{
  // Server configuration
  "coachntt.server.host": "localhost",
  "coachntt.server.port": 3000,
  "coachntt.server.autoConnect": true,
  
  // API Keys (stored securely)
  "coachntt.server.openaiApiKey": "sk-...",
  "coachntt.server.elevenLabsApiKey": "...",
  
  // Database configuration
  "coachntt.server.chromaHost": "localhost",
  "coachntt.server.chromaPort": "8000",
  "coachntt.server.postgresHost": "localhost",
  "coachntt.server.postgresPort": "5432",
  
  // Feature settings
  "coachntt.audio.enabled": true,
  "coachntt.codeIntelligence.enabled": true
}
```

## Usage Examples

### Connecting to MCP Server

```typescript
// Via command palette
vscode.commands.executeCommand('coachntt.connect');

// Programmatically
const connectionManager = new ConnectionManager(context);
await connectionManager.connect();
```

### Calling MCP Tools

```typescript
const mcpClient = getMCPClient();

// Store a memory
const result = await mcpClient.storeMemory(
  "Important code pattern",
  { file: "example.ts", line: 42 }
);

// Search memories
const memories = await mcpClient.searchHybrid("authentication", 0.4, 10);

// Synthesize audio
const audio = await mcpClient.synthesizeAudio("Hello from CoachNTT!");
```

### Handling Connection States

```typescript
if (mcpClient.isConnected()) {
  // Perform MCP operations
} else {
  // Show connection prompt
  vscode.window.showErrorMessage(
    'Not connected to MCP server',
    'Connect'
  ).then(selection => {
    if (selection === 'Connect') {
      connectionManager.connect();
    }
  });
}
```

## Error Handling

The implementation includes comprehensive error handling:

1. **Connection Errors**: Displayed in notifications and output channel
2. **Tool Call Errors**: Wrapped with descriptive messages
3. **Transport Errors**: Auto-disconnect and cleanup
4. **Configuration Errors**: Validation and user guidance

## Best Practices

1. **Always check connection state** before calling tools
2. **Use progress indicators** for long-running operations
3. **Cache responses** when appropriate (e.g., tier stats)
4. **Provide fallbacks** for missing configuration
5. **Log to output channel** for debugging

## Future Enhancements

1. **WebSocket Transport**: For remote MCP servers
2. **Multiple Server Support**: Connect to multiple MCP servers
3. **Custom Tool Registration**: Allow extensions to add tools
4. **Streaming Responses**: For real-time updates
5. **Authentication**: OAuth/JWT support for secure connections

## Debugging

1. Open the CoachNTT output channel: `View > Output > CoachNTT MCP Client`
2. Check connection status in the status bar
3. Use Developer Tools console for extension debugging
4. Enable verbose logging in settings (when implemented)

## Testing

To test the MCP client:

1. Ensure MCP server is running (Docker or local)
2. Configure API keys in settings
3. Run the extension in development mode
4. Test each command and verify tool responses
5. Check error handling with invalid configurations