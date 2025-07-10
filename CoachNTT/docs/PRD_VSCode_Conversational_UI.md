# Product Requirements Document: CoachNTT VSCode Conversational UI

## Executive Summary

This PRD defines the conversational user interface for the CoachNTT VSCode extension, transforming it from a memory browser into a full-featured AI coding assistant. The extension will provide a rich chat interface integrated with Claude AI, enabling natural conversations about code while leveraging the MCP server's memory and file system capabilities.

## Problem Statement

Current limitations:
- No conversational interface in the VSCode extension
- Cannot have discussions about code within the IDE
- API keys buried in settings, not user-friendly
- No visual conversation type selection
- Missing integration between code context and AI responses

## Solution Overview

Build a comprehensive conversational UI that:
1. Provides webview-based chat interface in the sidebar
2. Integrates Claude API for intelligent responses
3. Offers inline configuration for API keys and voices
4. Implements conversation type selection with auto-detection
5. Seamlessly combines editor context with AI capabilities

## User Interface Design

### 1. Main Conversational Panel

```
┌─ COACHNTT ─────────────────────────────────────┐
│ ╔═══════════════════════════════════════════╗ │
│ ║ 🧠 CoachNTT - AI Coding Assistant        ║ │
│ ╚═══════════════════════════════════════════╝ │
│                                                │
│ ┌─ 🔌 Connection & Configuration ───────────┐ │
│ │ ● Connected to localhost:3000              │ │
│ │ [Disconnect] [⚙️ Settings]                 │ │
│ │                                            │ │
│ │ API Keys:                                  │ │
│ │ OpenAI:    [•••••••••••••••] [Edit]      │ │
│ │ ElevenLabs: [•••••••••••••••] [Edit]     │ │
│ │ Claude:     [•••••••••••••••] [Edit]      │ │
│ │                                            │ │
│ │ Voice: [Rachel (Natural) ▼]               │ │
│ │ Mode:  [🔍 Auto-detect ▼]                 │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ ┌─ 💬 Conversation ─────────────────────────┐ │
│ │ [New Chat] [Clear] [Export] [History ▼]   │ │
│ │ ┌────────────────────────────────────────┐ │ │
│ │ │ 👤 How does the auth system work?      │ │ │
│ │ │                                         │ │ │
│ │ │ 🤖 Looking at your codebase...         │ │ │
│ │ │                                         │ │ │
│ │ │ The authentication system uses JWT      │ │ │
│ │ │ tokens with a refresh rotation         │ │ │
│ │ │ mechanism. Here's how it works:        │ │ │
│ │ │                                         │ │ │
│ │ │ ```typescript                          │ │ │
│ │ │ // auth/jwt-handler.ts:45              │ │ │
│ │ │ async function generateTokens(user) {   │ │ │
│ │ │   const access = jwt.sign(...)         │ │ │
│ │ │   const refresh = jwt.sign(...)        │ │ │
│ │ │ }                                       │ │ │
│ │ │ ```                                     │ │ │
│ │ │                                         │ │ │
│ │ │ 📄 Files: auth/jwt-handler.ts:45       │ │ │
│ │ │ 🧠 Memory: "JWT implementation"        │ │ │
│ │ │ 🔊 [Play Response]                     │ │ │
│ │ └────────────────────────────────────────┘ │ │
│ │                                            │ │
│ │ [💭 Type your message...] [📎] [🎤] [Send] │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ ┌─ 🧠 Active Context ────────────────────────┐ │
│ │ 📄 Current: auth/jwt-handler.ts:45         │ │
│ │ 📁 Workspace: /Users/dev/project           │ │
│ │ 🎯 Mode: 🔍 Debugging (87% confident)      │ │
│ │ 💾 Memories: 23 relevant                   │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ ┌─ 🎵 Audio Queue ──────────────────────────┐ │
│ │ ▶️ Playing: "The authentication system..." │ │
│ │ ━━━━━●━━━━━━━━━ 1:23/3:45               │ │
│ │ [⏮️] [⏯️] [⏭️]  🔊 80%  Speed: 1.0x      │ │
│ │                                            │ │
│ │ Queue: 2 responses waiting                 │ │
│ └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### 2. Component Specifications

#### 2.1 Configuration Panel
- **Inline API Key Management**: Masked input fields with edit/save
- **Test Connection**: Verify each API key works
- **Voice Selector**: Dropdown populated from ElevenLabs API
- **Mode Selector**: Conversation type with auto-detect option
- **Settings Button**: Opens advanced configuration

#### 2.2 Conversation Area
- **Message Bubbles**: Distinguished user/assistant messages
- **Code Blocks**: Syntax highlighted with file references
- **Interactive Elements**:
  - Click file references to open
  - Click line numbers to jump
  - Copy button for code blocks
  - Play button for audio synthesis
- **Memory/Context Indicators**: Show what informed the response
- **Streaming Display**: Progressive rendering of responses

#### 2.3 Input Area
- **Auto-Expanding Textarea**: Grows with content
- **Attachment Button**: Attach current selection/file
- **Voice Input**: Future capability placeholder
- **Send Options**: Send with Cmd/Ctrl+Enter

#### 2.4 Context Panel
- **Current File**: Show active editor file
- **Workspace**: Current workspace path
- **Detected Mode**: Show conversation type and confidence
- **Memory Count**: Relevant memories found

#### 2.5 Audio Controls
- **Playback Controls**: Play/pause/skip
- **Progress Bar**: Visual progress with time
- **Volume/Speed**: Inline controls
- **Queue Display**: Show pending audio

## Technical Architecture

### 1. Webview Implementation

#### 1.1 Technology Stack
- **Framework**: React (or vanilla JS with Web Components)
- **Styling**: CSS with VSCode theme variables
- **State Management**: React Context or Redux
- **Communication**: VSCode postMessage API

#### 1.2 Webview Structure
```typescript
interface WebviewState {
  conversation: {
    messages: Message[];
    currentType: ConversationType;
    isStreaming: boolean;
    streamingChunks: StreamChunk[];
  };
  
  configuration: {
    apiKeys: {
      openai: string;
      elevenlabs: string;
      claude: string;
    };
    selectedVoice: Voice;
    conversationMode: 'auto' | ConversationType;
  };
  
  context: {
    currentFile: string;
    workspace: string;
    relevantMemories: Memory[];
    detectedType: {
      type: ConversationType;
      confidence: number;
    };
  };
  
  audio: {
    queue: AudioItem[];
    currentItem?: AudioItem;
    isPlaying: boolean;
    volume: number;
    speed: number;
  };
}
```

### 2. Claude API Integration

#### 2.1 Service Architecture
```typescript
class ClaudeService {
  async sendMessage(
    message: string,
    context: Context,
    conversationType: ConversationType
  ): Promise<StreamResponse> {
    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(context, conversationType);
    
    // Create streaming request
    const stream = await this.claude.messages.create({
      model: 'claude-3-opus-20240229',
      messages: [...this.history, { role: 'user', content: message }],
      system: systemPrompt,
      stream: true,
      max_tokens: this.getMaxTokens(conversationType),
      temperature: this.getTemperature(conversationType)
    });
    
    return this.handleStream(stream);
  }
  
  private buildSystemPrompt(
    context: Context,
    type: ConversationType
  ): string {
    return `You are CoachNTT, an AI coding assistant with access to:
    - Current file: ${context.currentFile}
    - Workspace: ${context.workspace}
    - Relevant memories: ${context.memories.length}
    - Conversation type: ${type}
    
    ${this.getTypeInstructions(type)}
    
    Available tools: ${this.getAvailableTools(type)}`;
  }
}
```

#### 2.2 Tool Integration
```typescript
class ToolOrchestrator {
  async executeTool(
    toolName: string,
    params: any
  ): Promise<ToolResult> {
    // Call MCP server tool
    const result = await this.mcpClient.callTool(toolName, params);
    
    // Process result for UI
    return this.processToolResult(result);
  }
  
  async planExecution(
    query: string,
    type: ConversationType
  ): Promise<ExecutionPlan> {
    // Get execution plan from MCP
    const plan = await this.mcpClient.callTool('plan_query_execution', {
      query,
      conversationType: type
    });
    
    return plan;
  }
}
```

### 3. Message Handling

#### 3.1 Message Flow
```typescript
// User sends message
1. Capture message and current context
2. Detect conversation type (or use selected)
3. Build context from editor state
4. Query relevant memories
5. Send to Claude with context
6. Stream response chunks
7. Execute any tool calls
8. Render formatted response
9. Optionally synthesize audio
```

#### 3.2 Context Building
```typescript
class ContextBuilder {
  async buildContext(
    message: string,
    editorState: EditorState
  ): Promise<Context> {
    const context = {
      currentFile: editorState.activeFile,
      selection: editorState.selection,
      workspace: editorState.workspace,
      recentFiles: editorState.recentFiles,
      
      // Get relevant memories
      memories: await this.getRelevantMemories(message),
      
      // Get code context
      codeContext: await this.getCodeContext(editorState),
      
      // Detect conversation type
      conversationType: await this.detectType(message)
    };
    
    return context;
  }
}
```

### 4. Streaming Response Handler

#### 4.1 Progressive Rendering
```typescript
class StreamHandler {
  async handleStream(
    stream: AsyncIterable<StreamChunk>,
    onChunk: (chunk: ProcessedChunk) => void
  ) {
    for await (const chunk of stream) {
      const processed = await this.processChunk(chunk);
      
      // Handle different chunk types
      switch (processed.type) {
        case 'text':
          onChunk(processed);
          break;
          
        case 'code':
          await this.highlightCode(processed);
          onChunk(processed);
          break;
          
        case 'tool_call':
          const result = await this.executeTool(processed);
          onChunk(result);
          break;
          
        case 'file_reference':
          await this.enrichFileReference(processed);
          onChunk(processed);
          break;
      }
    }
  }
}
```

### 5. Configuration Management

#### 5.1 Settings Service
```typescript
class SettingsService {
  async saveApiKey(
    service: 'openai' | 'elevenlabs' | 'claude',
    key: string
  ): Promise<void> {
    // Validate key
    const isValid = await this.validateApiKey(service, key);
    
    if (!isValid) {
      throw new Error(`Invalid ${service} API key`);
    }
    
    // Save to VSCode settings
    await vscode.workspace.getConfiguration('coachntt').update(
      `${service}ApiKey`,
      key,
      vscode.ConfigurationTarget.Global
    );
    
    // Update MCP server
    await this.updateMCPEnvironment(service, key);
  }
  
  async loadVoices(): Promise<Voice[]> {
    return await this.mcpClient.callTool('get_available_voices');
  }
}
```

## Features

### 1. Conversation Management

#### 1.1 History
- Save conversation history locally
- Search through past conversations
- Export conversations as markdown
- Resume previous conversations

#### 1.2 Context Preservation
- Maintain context across messages
- Reference previous responses
- Track file changes during conversation
- Update context dynamically

### 2. Smart Features

#### 2.1 Auto-Complete
- Suggest common questions based on context
- Complete file paths and symbol names
- Offer quick actions based on selection

#### 2.2 Quick Actions
- "Explain this" for selections
- "Fix this error" for problems
- "Optimize this" for performance
- "Add tests" for functions

### 3. Integration Features

#### 3.1 Editor Integration
- Highlight referenced lines
- Insert suggested code
- Apply fixes directly
- Navigate to definitions

#### 3.2 Memory Integration
- Show which memories informed response
- Allow memory exploration inline
- Create new memories from conversation

## Implementation Plan

### Phase 1: Basic Chat UI (Week 1-2)
- Webview setup with React
- Basic message display
- Simple input handling
- VSCode theme integration

### Phase 2: Claude Integration (Week 3-4)
- API service implementation
- Streaming response handling
- Tool execution framework
- Error handling

### Phase 3: Configuration UI (Week 5)
- API key management interface
- Voice selection
- Conversation type selector
- Settings persistence

### Phase 4: Context Integration (Week 6)
- Editor state capture
- Memory integration
- File reference handling
- Code highlighting

### Phase 5: Audio Integration (Week 7)
- Connect to audio synthesis
- Queue management UI
- Playback controls
- Voice selection

### Phase 6: Polish & Testing (Week 8)
- Performance optimization
- Accessibility improvements
- Comprehensive testing
- Documentation

## Success Metrics

1. **Response Time**: < 500ms to first token
2. **Streaming Performance**: Smooth rendering at 30+ tokens/second
3. **Context Accuracy**: 95%+ relevant context inclusion
4. **UI Responsiveness**: < 100ms for all interactions
5. **Memory Efficiency**: < 100MB additional memory usage

## Security Considerations

1. **API Key Storage**: Use VSCode secure storage
2. **Input Sanitization**: Prevent XSS in webview
3. **Rate Limiting**: Implement client-side limits
4. **Data Privacy**: No conversation data leaves local machine
5. **Workspace Isolation**: Respect workspace boundaries

## Future Enhancements

1. **Voice Input**: Speech-to-text for questions
2. **Multi-Model Support**: GPT-4, Gemini, etc.
3. **Collaborative Features**: Share conversations
4. **Custom Prompts**: User-defined conversation starters
5. **Plugin System**: Extend with custom tools