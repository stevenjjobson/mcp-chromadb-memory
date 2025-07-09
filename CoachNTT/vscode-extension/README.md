# CoachNTT VSCode Extension

Rich UI extension for the CoachNTT conversational AI platform, providing visual memory management, audio playback controls, and seamless integration with the MCP server.

## Overview

The CoachNTT VSCode extension transforms your IDE into a powerful conversational AI interface with:
- 🎵 Full audio playback controls with queue management
- 📊 Visual memory explorer with three-tier hierarchy
- 🔌 Real-time MCP server connection status
- ⚙️ Comprehensive settings and customization

## Features

### Memory Management
- **Hierarchical Tree View**: Browse Working, Session, and Long-term memory tiers
- **Search Integration**: Quick memory search with filters
- **Context Menus**: Right-click actions for memory operations
- **Real-time Updates**: Auto-refresh on memory changes

### Audio Capabilities
- **Playback Controls**: Play, pause, stop, skip with visual feedback
- **Queue Management**: View and manage audio queue
- **Volume & Speed**: Adjustable playback parameters
- **Voice Selection**: Choose from available ElevenLabs voices
- **Status Bar Integration**: Quick controls always visible

### Session Tracking
- **Active Session Display**: Current conversation context
- **Memory Statistics**: Real-time memory usage and distribution
- **Topic Tracking**: Automatic topic extraction and display

## Installation

### From VSIX (Recommended)
```bash
# Build the extension
npm run package

# Install in VSCode
code --install-extension coachntt-vscode-*.vsix
```

### From Source
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Open in VSCode
code .

# Press F5 to launch Extension Development Host
```

## UI Layout

The extension follows the comprehensive UI contract:

```
┌─ COACHNTT ─────────────────────────────────────┐
│ ╔═══════════════════════════════════════════╗ │
│ ║ 🧠 CoachNTT - AI Coding Assistant        ║ │
│ ╚═══════════════════════════════════════════╝ │
│                                                │
│ ┌─ 🔌 Connection Status ─────────────────────┐ │
│ │ ● Connected to localhost:3000              │ │
│ │ [Disconnect] [Settings]                    │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ ┌─ 💭 Memory Explorer ──────────────────────┐ │
│ │ 🔍 [Search memories...]                    │ │
│ │ ▼ 📁 Working Tier (48h) - 23 items       │ │
│ │ ▼ 📁 Session Tier (14d) - 67 items       │ │
│ │ ▶ 📁 Long-term Tier - 66 items           │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ ┌─ 🎵 Audio Controls ───────────────────────┐ │
│ │ Now Playing: "Memory content..."           │ │
│ │ ▶️ ━━━━━●━━━━━━━━━ 1:23/3:45             │ │
│ │ [⏮️] [⏯️] [⏭️]  🔊 80%  Speed: 1.0x      │ │
│ └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

## Configuration

### Extension Settings

Access via File → Preferences → Settings → Extensions → CoachNTT

#### Connection Settings
- `coachntt.server.host`: MCP server host (default: localhost)
- `coachntt.server.port`: MCP server port (default: 3000)
- `coachntt.server.autoConnect`: Auto-connect on startup
- `coachntt.server.apiKey`: Optional API key for authentication

#### Audio Settings
- `coachntt.audio.enabled`: Enable audio features
- `coachntt.audio.autoPlay`: Auto-play responses
- `coachntt.audio.defaultVolume`: Default volume (0-1)
- `coachntt.audio.defaultSpeed`: Playback speed (0.5-2.0)
- `coachntt.audio.queueBehavior`: append | replace | interrupt
- `coachntt.audio.cacheAudio`: Cache synthesized audio
- `coachntt.audio.maxCacheSize`: Cache size limit in MB

#### Memory Settings
- `coachntt.memory.autoStore`: Auto-store important snippets
- `coachntt.memory.importanceThreshold`: Min importance (0-1)
- `coachntt.memory.searchType`: semantic | exact | hybrid
- `coachntt.memory.workingTierDuration`: Hours for working tier
- `coachntt.memory.sessionTierDuration`: Days for session tier

#### UI Settings
- `coachntt.ui.theme`: light | dark | auto
- `coachntt.ui.showActivityBarIcon`: Show in activity bar
- `coachntt.ui.showInlineDecorations`: Show code decorations
- `coachntt.ui.compactMemoryView`: Use compact memory display

## Commands

Access via Command Palette (Ctrl/Cmd + Shift + P):

### Connection
- `CoachNTT: Connect to Server`
- `CoachNTT: Disconnect from Server`
- `CoachNTT: Configure Server Settings`

### Memory Operations
- `CoachNTT: Store Selection as Memory`
- `CoachNTT: Search Memories`
- `CoachNTT: Show Memory Statistics`
- `CoachNTT: Export Memory Database`
- `CoachNTT: Clear Working Tier`

### Audio Features
- `CoachNTT: Speak Selection`
- `CoachNTT: Speak Current File`
- `CoachNTT: Show Audio Controls`
- `CoachNTT: Configure Voice Settings`

### Session Management
- `CoachNTT: Start New Session`
- `CoachNTT: End Current Session`
- `CoachNTT: View Session History`

## Context Menus

### Editor Context Menu
Right-click in editor to access:
- Store Selection as Memory
- Speak Selection (when audio enabled)

### Memory Tree Context Menu
Right-click on memory items:
- Speak Memory
- Copy Content
- Edit Memory
- Add Tags
- Delete Memory

## Keyboard Shortcuts

Default shortcuts (customizable):
- `Ctrl+Alt+M`: Store selection as memory
- `Ctrl+Alt+S`: Search memories
- `Ctrl+Alt+P`: Speak selection
- `Ctrl+Alt+Space`: Toggle audio playback

## Development

### Project Structure
```
vscode-extension/
├── src/
│   ├── extension.ts          # Main entry point
│   ├── services/
│   │   ├── mcp-client.ts     # MCP server communication
│   │   └── audio-playback-service.ts
│   ├── providers/
│   │   ├── memory-provider.ts
│   │   └── audio-queue-provider.ts
│   ├── views/
│   │   └── audio-status-bar.ts
│   └── commands/
│       └── index.ts
├── resources/
│   ├── icon.png
│   └── activity-bar-icon.svg
└── package.json
```

### Building

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode
npm run watch

# Package extension
npm run package
```

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Debugging

1. Open in VSCode
2. Press F5 to launch Extension Development Host
3. Set breakpoints in TypeScript files
4. Use Debug Console for inspection

## API Integration

### MCP Client Usage

```typescript
import { MCPClient } from './services/mcp-client';

const client = new MCPClient(context);
await client.connect('localhost', 3000);

// Call MCP tools
const memories = await client.callTool('recall_memories', {
  query: 'authentication',
  limit: 10
});

// Synthesize audio
const audio = await client.callTool('synthesize_audio', {
  text: 'Hello world',
  voice: 'Rachel'
});
```

### Audio Playback

```typescript
import { AudioPlaybackService } from './services/audio-playback-service';

const audioService = new AudioPlaybackService(context);

// Play audio from base64
await audioService.playAudio(audio.audioData, audio.mimeType);

// Queue management
audioService.addToQueue(audioItem);
audioService.clearQueue();
```

## Troubleshooting

### Extension Not Activating
1. Check Output panel → CoachNTT for errors
2. Verify extension is enabled in Extensions view
3. Reload VSCode window

### Connection Issues
1. Ensure MCP server is running
2. Check server host/port in settings
3. Verify firewall not blocking connection

### Audio Not Playing
1. Check audio is enabled in settings
2. Verify system audio is working
3. Check browser console for errors (Webview)

### Memory Tree Empty
1. Verify connection to MCP server
2. Check if memories exist in database
3. Try manual refresh command

## Performance

- **Memory Tree**: Virtual scrolling for large datasets
- **Audio Cache**: LRU cache with configurable size
- **Search Debouncing**: 300ms delay on typing
- **Lazy Loading**: Load memories on-demand

## Accessibility

- Full keyboard navigation support
- Screen reader compatible
- High contrast theme support
- Customizable font sizes

## Future Enhancements

- [ ] Voice commands for hands-free operation
- [ ] Memory visualization graphs
- [ ] Export to various formats
- [ ] Team collaboration features
- [ ] Custom voice training

## Contributing

See main project CONTRIBUTING.md for guidelines.

## License

MIT License - Part of the CoachNTT project.