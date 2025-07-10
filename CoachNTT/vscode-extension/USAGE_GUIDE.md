# CoachNTT VSCode Extension - Usage Guide

## 🚀 Quick Start

### 1. Installation
```bash
code --install-extension coachntt-vscode-1.0.0.vsix
```

### 2. Required Services
Before using the extension, ensure these services are running:
```bash
# From the project root directory
docker-compose up -d chromadb postgres
```

### 3. Configure API Keys

The extension requires two API keys to function properly:

1. **Open VSCode Settings**
   - Press `Ctrl+,` (Windows/Linux) or `Cmd+,` (Mac)
   - Search for "coachntt"

2. **Set Your API Keys**
   - `CoachNTT: Server: OpenAI API Key` - Your OpenAI API key (required for embeddings)
   - `CoachNTT: Server: ElevenLabs API Key` - Your ElevenLabs API key (for voice synthesis)

**Alternative: JSON Settings**
```json
{
  "coachntt.server.openaiApiKey": "your-openai-api-key",
  "coachntt.server.elevenLabsApiKey": "your-elevenlabs-api-key"
}
```

## 🎯 Using the Extension

### Accessing the CoachNTT Sidebar

1. **Look for the CoachNTT icon** in the Activity Bar (left side of VSCode)
2. Click it to open the CoachNTT sidebar
3. You'll see two panels:
   - **Memories** - Browse your stored conversations and code snippets
   - **Audio Queue** - Manage voice synthesis playback

### Connection Management

#### Auto-Connect (Default)
The extension automatically connects to the MCP server on startup.

#### Manual Connection
- **Status Bar**: Click the connection status indicator (bottom bar)
- **Command Palette**: `Ctrl+Shift+P` → "CoachNTT: Connect to Server"

#### Connection Status Indicators
- 🟢 **Connected** - Server is running and connected
- 🟡 **Connecting** - Attempting to connect
- 🔴 **Disconnected** - Not connected (click to connect)

### Core Features

#### 1. Storing Memories
**Method 1: Context Menu**
1. Select text in the editor
2. Right-click → "Store Selection as Memory"
3. The AI will assess importance and store if above threshold

**Method 2: Command**
- Select text
- Press `Ctrl+Alt+M` or use Command Palette → "CoachNTT: Store Selection as Memory"

#### 2. Searching Memories
1. Press `Ctrl+Shift+P` → "CoachNTT: Search Memories"
2. Choose search type:
   - **Hybrid** (Recommended) - Combines exact and semantic search
   - **Semantic** - Search by meaning/concept
   - **Exact** - Search for exact text matches
3. Enter your search query
4. Browse results in the quick pick menu
5. Select a memory to view full details

#### 3. Memory Explorer
In the CoachNTT sidebar:
- **Working Tier (48h)** - Recent context and active work
- **Session Tier (14d)** - Session history and completed tasks
- **Long-term Tier** - Permanent knowledge and important information

Click on any tier to expand and view memories.

#### 4. Text-to-Speech (Audio Synthesis)
**Method 1: Context Menu**
1. Select text in the editor
2. Right-click → "Speak Selection"

**Method 2: Command**
- Select text
- Press `Ctrl+Alt+P` or use Command Palette → "CoachNTT: Speak Selection"

**Audio Controls**
- Look for audio status in the bottom status bar
- Click to access playback controls
- Queue management in the sidebar's Audio Queue panel

#### 5. Memory Statistics
View memory system statistics:
- Command Palette → "CoachNTT: Show Memory Statistics"
- Shows tier distribution, total memories, and usage patterns

## ⚙️ Configuration Options

### Key Settings

#### Connection
- `coachntt.server.host` - MCP server host (default: localhost)
- `coachntt.server.autoConnect` - Auto-connect on startup (default: true)
- `coachntt.server.customPath` - Custom path to MCP server (optional)

#### Audio
- `coachntt.audio.enabled` - Enable audio features (default: true)
- `coachntt.audio.autoPlay` - Auto-play synthesized audio (default: false)
- `coachntt.audio.defaultVolume` - Volume level 0-1 (default: 0.8)
- `coachntt.audio.defaultSpeed` - Playback speed 0.5-2.0 (default: 1.0)

#### Memory
- `coachntt.memory.importanceThreshold` - Min importance to store (default: 0.3)
- `coachntt.memory.searchType` - Default search type (default: hybrid)
- `coachntt.memory.autoMigrate` - Auto-migrate between tiers (default: true)

## 🔍 Troubleshooting

### Extension Not Connecting
1. Check Docker services are running: `docker ps`
2. Verify API keys are set correctly
3. Check Output panel: View → Output → Select "CoachNTT MCP Client"

### No Activity Bar Icon
1. Right-click on Activity Bar
2. Ensure "CoachNTT" is checked
3. Restart VSCode if needed

### Audio Not Playing
1. Verify ElevenLabs API key is set
2. Check audio quota: Command Palette → "CoachNTT: Check Audio Quota"
3. Ensure audio is enabled in settings

### Memories Not Storing
1. Check OpenAI API key is set
2. Verify importance threshold setting
3. Ensure ChromaDB and PostgreSQL are running

## 📊 Current State & Limitations

### What's Working
✅ MCP server connection via stdio  
✅ Memory storage and retrieval  
✅ Three-tier memory organization  
✅ Audio synthesis via ElevenLabs  
✅ Search functionality (hybrid/semantic/exact)  
✅ Memory explorer with real-time updates  
✅ Session logging to Obsidian vault  

### What's Not Yet Implemented
❌ Conversational chat interface  
❌ Direct AI agent integration  
❌ Code intelligence features  
❌ Voice input/recording  
❌ Memory editing UI  

### Known Issues
- Audio playback uses browser-based audio (limited in VSCode environment)
- Large memory searches may be slow
- Memory tier migration runs on server schedule

## 🎯 Tips for Best Results

1. **Memory Organization**: Let the tier system work automatically - recent work stays in Working tier, completed sessions move to Session tier
2. **Search Strategy**: Use hybrid search for best results, exact search for specific code snippets
3. **Audio Queue**: Enable auto-play for continuous listening during code reviews
4. **API Keys**: Store them in VSCode settings rather than environment variables for persistence

## 📚 Next Steps

While the current implementation provides memory management and audio synthesis, the full conversational AI interface is still in development. You can:

1. Use the memory system to store important code context
2. Search through previous work and decisions
3. Listen to code explanations via text-to-speech
4. Track your development sessions

For conversational AI features, you'll need to use the MCP server directly through Claude Desktop or implement a chat interface in the extension.