# CoachNTT VSCode Extension Implementation Guide

## 🎯 Current Status & Gap Analysis

### ✅ Already Implemented
- MCP client connection and communication
- Memory Explorer tree view with tier hierarchy
- Basic audio synthesis (external playback)
- Status bar connection indicator
- Command palette integration
- Extension configuration schema

### ❌ Missing Core Features
1. **Webview Conversational UI** - The entire chat interface
2. **Claude API Integration** - AI conversation capabilities
3. **Integrated Audio Player** - In-VSCode audio playback
4. **Editor Integration** - CodeLens, hover providers, code actions
5. **State Management UI** - Timeline and diff viewers
6. **Intelligence Features** - Auto-capture, pattern detection

## 📋 Implementation Roadmap

### Phase 1: Core Conversational Features (Weeks 1-3)

#### Week 1: Webview Infrastructure
Create the foundation for the conversational UI:

```typescript
// New file structure
CoachNTT/vscode-extension/src/
├── views/
│   ├── conversation/
│   │   ├── ConversationPanel.ts      // Main webview panel class
│   │   ├── ConversationProvider.ts   // Webview content provider
│   │   └── MessageHandler.ts         // Extension <-> webview bridge
│   └── webview/
│       ├── index.html                // Webview HTML template
│       ├── styles/
│       │   ├── conversation.css      // Chat UI styles
│       │   └── markdown.css          // Message rendering
│       └── scripts/
│           ├── conversation.js       // Chat UI logic
│           ├── markdown-renderer.js  // Rich text rendering
│           └── message-types.js      // Message type handling
```

**Key Implementation Steps:**
1. Create `ConversationPanel` class extending vscode.WebviewPanel
2. Implement message passing between extension and webview
3. Design responsive chat UI with message bubbles
4. Add markdown rendering with syntax highlighting
5. Implement conversation state management

#### Week 2: Claude API Integration
Add AI conversation capabilities:

```typescript
// New services
src/services/
├── claude/
│   ├── ClaudeClient.ts          // Anthropic API wrapper
│   ├── ConversationManager.ts   // Conversation state & history
│   ├── PromptBuilder.ts         // Context-aware prompts
│   └── StreamHandler.ts         // Handle streaming responses
```

**Features to Implement:**
- Secure API key storage using VSCode SecretStorage
- Streaming response support with proper error handling
- Memory-enhanced prompts using MCP recall
- Conversation history management
- Token usage tracking

#### Week 3: Integrated Audio Player
Replace external audio with in-VSCode playback:

```typescript
// Audio enhancement
src/components/
├── audio/
│   ├── AudioPlayer.ts           // WebView audio player
│   ├── AudioQueueView.ts        // Queue visualization
│   ├── AudioControls.ts         // Playback controls
│   └── AudioCache.ts            // Local audio caching
```

**Implementation Details:**
- HTML5 audio element in webview
- Visual queue management interface
- Playback controls (play/pause/skip/speed)
- Progress bar with seeking
- Volume controls
- Local caching for repeated playback

### Phase 2: Editor Integration (Week 4)

#### CodeLens Provider
Show memory associations in the editor:

```typescript
src/providers/
├── MemoryCodeLensProvider.ts    // Memory indicators
├── MemoryHoverProvider.ts       // Hover information
├── MemoryActionProvider.ts      // Code actions
└── MemoryDecorationProvider.ts  // Visual highlights
```

**Features:**
- Memory count above functions/classes
- "Store as memory" quick action
- "Find similar implementations" action
- Hover preview of related memories
- Configurable decoration styles

### Phase 3: State Management UI (Week 5)

#### State Timeline View
Visual state management:

```typescript
src/views/
├── state/
│   ├── StateTimelineView.ts     // Timeline visualization
│   ├── StatePreviewPanel.ts     // State preview
│   └── StateDiffView.ts         // State comparison
```

### Phase 4: Intelligence Features (Weeks 6-7)

#### Auto-capture System
Automatic context preservation:

```typescript
src/services/
├── intelligence/
│   ├── AutoCaptureService.ts    // Capture orchestration
│   ├── CaptureTriggersDetector.ts // Event detection
│   ├── PatternDetector.ts       // Code pattern analysis
│   └── SmartNotifications.ts    // Proactive suggestions
```

## 🛠️ Implementation Details

### 1. Webview Conversation Panel

**Key Components:**
```typescript
// ConversationPanel.ts
export class ConversationPanel {
  private static currentPanel: ConversationPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    // Create panel with proper options
    const panel = vscode.window.createWebviewPanel(
      'coachntt.conversation',
      'CoachNTT Chat',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Generate HTML with proper CSP and resource URIs
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    // Handle messages from webview
    webview.onDidReceiveMessage(
      (message: any) => {
        switch (message.type) {
          case 'sendMessage':
            this._handleUserMessage(message.text);
            break;
          case 'playAudio':
            this._handleAudioPlayback(message.audioData);
            break;
        }
      },
      undefined,
      this._disposables
    );
  }
}
```

### 2. Claude API Service

**Implementation Strategy:**
```typescript
// ClaudeClient.ts
export class ClaudeClient {
  private apiKey: string;
  private readonly baseUrl = 'https://api.anthropic.com/v1';

  constructor(private secretStorage: vscode.SecretStorage) {}

  async initialize() {
    this.apiKey = await this.secretStorage.get('coachntt.claudeApiKey') || '';
    if (!this.apiKey) {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your Claude API key',
        password: true
      });
      if (key) {
        await this.secretStorage.store('coachntt.claudeApiKey', key);
        this.apiKey = key;
      }
    }
  }

  async sendMessage(
    message: string, 
    context: ConversationContext
  ): AsyncGenerator<string> {
    // Implement streaming API call
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        messages: context.messages,
        stream: true,
        max_tokens: 4096
      })
    });

    // Yield chunks as they arrive
    const reader = response.body?.getReader();
    // ... streaming implementation
  }
}
```

### 3. Rich Message Rendering

**Webview Script:**
```javascript
// conversation.js
class ConversationUI {
  constructor() {
    this.messageContainer = document.getElementById('messages');
    this.inputField = document.getElementById('messageInput');
    this.setupEventListeners();
  }

  addMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.role}`;
    
    if (message.role === 'assistant') {
      // Render markdown with syntax highlighting
      messageEl.innerHTML = this.renderMarkdown(message.content);
      this.highlightCode(messageEl);
    } else {
      messageEl.textContent = message.content;
    }
    
    this.messageContainer.appendChild(messageEl);
    this.scrollToBottom();
  }

  renderMarkdown(content) {
    // Use marked.js or similar for markdown rendering
    return marked.parse(content, {
      highlight: (code, lang) => {
        return hljs.highlight(code, { language: lang }).value;
      }
    });
  }
}
```

### 4. Audio Player Integration

**Webview Audio Component:**
```javascript
// audio-player.js
class AudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.queue = [];
    this.currentIndex = 0;
    this.setupControls();
  }

  async playAudio(base64Data, mimeType) {
    const blob = this.base64ToBlob(base64Data, mimeType);
    const url = URL.createObjectURL(blob);
    
    this.audio.src = url;
    await this.audio.play();
    
    // Update UI
    this.updateProgress();
    this.showControls();
  }

  setupControls() {
    // Play/pause button
    document.getElementById('playPause').addEventListener('click', () => {
      if (this.audio.paused) {
        this.audio.play();
      } else {
        this.audio.pause();
      }
    });

    // Progress bar
    this.audio.addEventListener('timeupdate', () => {
      const progress = (this.audio.currentTime / this.audio.duration) * 100;
      document.getElementById('progressBar').style.width = `${progress}%`;
    });
  }
}
```

## 🚀 Getting Started

### Step 1: Set Up Webview Infrastructure
```bash
cd CoachNTT/vscode-extension

# Create webview directories
mkdir -p src/views/conversation
mkdir -p media/scripts
mkdir -p media/styles

# Install webview dependencies
npm install marked highlight.js @vscode/webview-ui-toolkit
```

### Step 2: Implement Conversation Panel
1. Create `ConversationPanel.ts` with webview lifecycle management
2. Design `index.html` template with chat UI structure
3. Style with `conversation.css` for modern chat appearance
4. Add `conversation.js` for interactive behavior

### Step 3: Add Claude Integration
1. Create `ClaudeClient.ts` service
2. Implement secure API key management
3. Add streaming response handler
4. Integrate with conversation panel

### Step 4: Enhance Audio Features
1. Replace external audio playback
2. Add audio player to webview
3. Implement queue management
4. Add playback controls

## 📊 Success Criteria

### Week 1 Deliverables
- [ ] Working webview panel with chat UI
- [ ] Message rendering with markdown support
- [ ] Bidirectional communication between extension and webview
- [ ] Basic conversation state management

### Week 2 Deliverables
- [ ] Claude API integration with streaming
- [ ] Secure API key storage
- [ ] Memory-enhanced prompts
- [ ] Error handling and retry logic

### Week 3 Deliverables
- [ ] Integrated audio player in webview
- [ ] Audio queue management
- [ ] Playback controls
- [ ] Audio caching system

## 🧪 Testing Strategy

### Unit Tests
```typescript
// test/conversation.test.ts
describe('ConversationPanel', () => {
  it('should create webview with correct options', () => {
    // Test panel creation
  });

  it('should handle message passing', () => {
    // Test communication
  });
});

// test/claude-client.test.ts
describe('ClaudeClient', () => {
  it('should handle API authentication', () => {
    // Test auth flow
  });

  it('should stream responses correctly', () => {
    // Test streaming
  });
});
```

### Integration Tests
- Test full conversation flow
- Verify audio playback
- Test memory integration
- Validate error scenarios

## 📚 Resources

### Documentation
- [VSCode Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [Claude API Docs](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [MCP Protocol](https://modelcontextprotocol.io/docs)

### Libraries
- [Marked.js](https://marked.js.org/) - Markdown rendering
- [Highlight.js](https://highlightjs.org/) - Syntax highlighting
- [VSCode Webview UI Toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit) - UI components

---

This guide provides a clear path forward for implementing the missing features in the CoachNTT VSCode extension, prioritizing the conversational UI that makes this extension unique.