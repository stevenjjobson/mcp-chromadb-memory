# VS Code Extension API Integration

## Overview

This document details the integration between the VS Code Extension and the MCP ChromaDB Memory Server, including API specifications, data models, and communication patterns.

## MCP Client Implementation

### Connection Management

```typescript
export interface MCPConfig {
  serverUrl: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class MCPClient {
  private ws: WebSocket | null = null;
  private requestQueue: Map<string, PendingRequest> = new Map();
  private connectionState: ConnectionState = 'disconnected';
  
  constructor(private config: MCPConfig) {}
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.serverUrl);
      
      this.ws.on('open', () => {
        this.connectionState = 'connected';
        this.emit('connected');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });
      
      this.ws.on('error', (error) => {
        this.handleError(error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        this.handleDisconnect();
      });
    });
  }
  
  async call<T>(method: string, params?: any): Promise<T> {
    const id = this.generateRequestId();
    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: method,
        arguments: params
      },
      id
    };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestQueue.delete(id);
        reject(new Error('Request timeout'));
      }, this.config.timeout || 30000);
      
      this.requestQueue.set(id, {
        resolve,
        reject,
        timeout
      });
      
      this.ws?.send(JSON.stringify(request));
    });
  }
}
```

### Retry Logic

```typescript
export class RetryableClient extends MCPClient {
  private retryCount = 0;
  
  async connectWithRetry(): Promise<void> {
    while (this.retryCount < (this.config.retryAttempts || 5)) {
      try {
        await this.connect();
        this.retryCount = 0;
        return;
      } catch (error) {
        this.retryCount++;
        const delay = this.calculateBackoff(this.retryCount);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (this.retryCount >= (this.config.retryAttempts || 5)) {
          throw new Error('Max retry attempts reached');
        }
      }
    }
  }
  
  private calculateBackoff(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelay || 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 0.3 * delay;
    return delay + jitter;
  }
}
```

## API Methods

### Memory Operations

```typescript
export interface MemoryAPI {
  // Standard memory operations
  storeMemory(content: string, context?: string, metadata?: any): Promise<StoreResult>;
  recallMemories(query: string, context?: string, limit?: number): Promise<Memory[]>;
  deleteMemory(memoryId: string): Promise<boolean>;
  clearAllMemories(): Promise<void>;
  getMemoryStats(): Promise<MemoryStats>;
  
  // Enhanced memory operations
  searchExact(query: string, field?: string, limit?: number): Promise<Memory[]>;
  searchHybrid(query: string, context?: string, exactWeight?: number, limit?: number): Promise<MemoryScore[]>;
  getCompressedContext(query: string, maxTokens?: number): Promise<CompressedContext>;
  getOptimizedMemory(memoryId: string, maxTokens?: number): Promise<OptimizedMemory>;
  analyzeAccessPatterns(): Promise<AccessPatternAnalysis>;
}

// Implementation
export class MemoryService implements MemoryAPI {
  constructor(private client: MCPClient) {}
  
  async storeMemory(content: string, context?: string, metadata?: any): Promise<StoreResult> {
    // Add file context from VS Code
    const editor = vscode.window.activeTextEditor;
    const enhancedMetadata = {
      ...metadata,
      file: editor?.document.fileName,
      line: editor?.selection.start.line,
      language: editor?.document.languageId,
      workspace: vscode.workspace.name
    };
    
    return this.client.call<StoreResult>('store_memory', {
      content,
      context: context || 'code_snippet',
      metadata: enhancedMetadata
    });
  }
  
  async searchHybrid(
    query: string,
    context?: string,
    exactWeight: number = 0.4,
    limit: number = 20
  ): Promise<MemoryScore[]> {
    const results = await this.client.call<any>('search_hybrid', {
      query,
      context,
      exactWeight,
      limit
    });
    
    // Parse and enhance results
    return results.memories.map((m: any) => ({
      memory: this.parseMemory(m),
      semanticScore: m.semanticScore,
      exactScore: m.exactScore,
      totalScore: m.totalScore
    }));
  }
}
```

### Vault Operations

```typescript
export interface VaultAPI {
  registerVault(name: string, path: string, type: VaultType): Promise<string>;
  switchVault(vaultId: string): Promise<void>;
  listVaults(): Promise<VaultInfo[]>;
  backupVault(vaultId?: string): Promise<string>;
  restoreVault(backupPath: string, targetVaultId?: string): Promise<void>;
  getVaultStats(vaultId?: string): Promise<VaultStats>;
}

export class VaultService implements VaultAPI {
  constructor(private client: MCPClient) {}
  
  async switchVault(vaultId: string): Promise<void> {
    await this.client.call('switch_vault', { vaultId });
    
    // Update VS Code context
    vscode.commands.executeCommand('setContext', 'cognitive.activeVault', vaultId);
    
    // Refresh all views
    this.emit('vaultChanged', vaultId);
  }
  
  async listVaults(): Promise<VaultInfo[]> {
    const response = await this.client.call<any>('list_vaults');
    return response.vaults.map(this.parseVaultInfo);
  }
}
```

### State Operations

```typescript
export interface StateAPI {
  captureState(name: string, options?: CaptureOptions): Promise<string>;
  restoreState(stateId: string): Promise<void>;
  listStates(vaultId?: string): Promise<StateInfo[]>;
  diffStates(stateId1: string, stateId2: string): Promise<StateDiff>;
  deleteState(stateId: string): Promise<void>;
}

export class StateService implements StateAPI {
  constructor(private client: MCPClient) {}
  
  async captureState(name: string, options?: CaptureOptions): Promise<string> {
    // Gather VS Code context
    const workspaceState = await this.gatherWorkspaceState();
    
    const stateId = await this.client.call<string>('capture_state', {
      name,
      description: options?.description,
      tags: options?.tags || this.generateTags(),
      importance: options?.importance || 0.7,
      expiresInDays: options?.expiresInDays,
      metadata: {
        ...workspaceState,
        ...options?.metadata
      }
    });
    
    // Show notification
    vscode.window.showInformationMessage(`State captured: ${name}`);
    
    return stateId;
  }
  
  private async gatherWorkspaceState(): Promise<WorkspaceState> {
    return {
      openEditors: vscode.window.tabGroups.all.flatMap(g => 
        g.tabs.map(t => t.input?.uri?.fsPath).filter(Boolean)
      ),
      activeFile: vscode.window.activeTextEditor?.document.fileName,
      workspaceFolders: vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath),
      gitBranch: await this.getGitBranch(),
      extensions: vscode.extensions.all
        .filter(e => e.isActive)
        .map(e => e.id)
    };
  }
}
```

## Data Models

### Memory Types

```typescript
export interface Memory {
  id: string;
  content: string;
  context: MemoryContext;
  importance: number;
  timestamp: Date;
  metadata: MemoryMetadata;
  accessCount: number;
  lastAccessed: Date;
}

export interface MemoryMetadata {
  file?: string;
  line?: number;
  language?: string;
  workspace?: string;
  author?: string;
  tags?: string[];
  [key: string]: any;
}

export type MemoryContext = 
  | 'general'
  | 'code_snippet'
  | 'user_preference'
  | 'task_critical'
  | 'documentation'
  | 'debugging'
  | 'architecture';

export interface MemoryScore {
  memory: Memory;
  semanticScore: number;
  exactScore?: number;
  recencyScore: number;
  importanceScore: number;
  totalScore: number;
}
```

### Vault Types

```typescript
export interface VaultInfo {
  id: string;
  name: string;
  path: string;
  type: VaultType;
  isActive: boolean;
  created: Date;
  lastAccessed: Date;
  lastModified: Date;
  metadata?: Record<string, any>;
  backup?: {
    enabled: boolean;
    lastBackup?: Date;
    backupPath?: string;
  };
}

export type VaultType = 'project' | 'personal' | 'team';

export interface VaultStats {
  id: string;
  name: string;
  fileCount: number;
  totalSize: number;
  memoryCount: number;
  stateCount: number;
}
```

### State Types

```typescript
export interface StateInfo {
  id: string;
  name: string;
  vaultId: string;
  timestamp: Date;
  description?: string;
  tags: string[];
  size: number;
  compressed: boolean;
  metadata: StateMetadata;
}

export interface StateMetadata {
  importance: number;
  autoCapture: boolean;
  expiresAt?: Date;
  workspaceState?: WorkspaceState;
}

export interface WorkspaceState {
  openEditors: string[];
  activeFile?: string;
  workspaceFolders?: string[];
  gitBranch?: string;
  extensions?: string[];
}

export interface StateDiff {
  stateId1: string;
  stateId2: string;
  timestamp: Date;
  differences: {
    files: {
      added: string[];
      removed: string[];
      modified: string[];
    };
    memories: {
      added: number;
      removed: number;
    };
    metadata: Array<{
      field: string;
      before: any;
      after: any;
    }>;
  };
}
```

## Event System

### Event Types

```typescript
export interface ExtensionEvents {
  // Connection events
  'connection:connected': void;
  'connection:disconnected': { reason: string };
  'connection:error': { error: Error };
  
  // Memory events
  'memory:stored': { memory: Memory };
  'memory:recalled': { memories: Memory[] };
  'memory:deleted': { memoryId: string };
  
  // Vault events
  'vault:switched': { vaultId: string };
  'vault:created': { vault: VaultInfo };
  'vault:backedUp': { backupPath: string };
  
  // State events
  'state:captured': { stateId: string };
  'state:restored': { stateId: string };
  'state:deleted': { stateId: string };
}
```

### Event Implementation

```typescript
export class EventBus {
  private emitter = new vscode.EventEmitter<any>();
  
  on<K extends keyof ExtensionEvents>(
    event: K,
    handler: (data: ExtensionEvents[K]) => void
  ): vscode.Disposable {
    return this.emitter.event((e) => {
      if (e.type === event) {
        handler(e.data);
      }
    });
  }
  
  emit<K extends keyof ExtensionEvents>(
    event: K,
    data: ExtensionEvents[K]
  ): void {
    this.emitter.fire({ type: event, data });
  }
}
```

## Caching Strategy

### Memory Cache

```typescript
export class MemoryCache {
  private cache = new Map<string, CacheEntry<Memory>>();
  private lru = new LRUCache<string, boolean>(1000);
  
  async get(key: string): Promise<Memory | undefined> {
    const entry = this.cache.get(key);
    
    if (entry && !this.isExpired(entry)) {
      this.lru.get(key); // Update access
      return entry.value;
    }
    
    return undefined;
  }
  
  set(key: string, value: Memory, ttl: number = 300000): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
    
    this.lru.set(key, true);
    
    // Evict if necessary
    if (this.cache.size > 1000) {
      const leastUsed = this.lru.getLeastRecentlyUsed();
      if (leastUsed) {
        this.cache.delete(leastUsed);
      }
    }
  }
}
```

### Request Deduplication

```typescript
export class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();
  
  async dedupe<T>(
    key: string,
    factory: () => Promise<T>
  ): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      return existing;
    }
    
    const promise = factory().finally(() => {
      this.pending.delete(key);
    });
    
    this.pending.set(key, promise);
    return promise;
  }
}
```

## Error Handling

### Error Types

```typescript
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class ConnectionError extends MCPError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTION_ERROR', details);
  }
}

export class TimeoutError extends MCPError {
  constructor(message: string, details?: any) {
    super(message, 'TIMEOUT_ERROR', details);
  }
}
```

### Error Recovery

```typescript
export class ErrorRecovery {
  async withRecovery<T>(
    operation: () => Promise<T>,
    options: RecoveryOptions = {}
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ConnectionError) {
        if (options.reconnect) {
          await this.reconnect();
          return operation();
        }
      }
      
      if (error instanceof TimeoutError) {
        if (options.retry) {
          await this.delay(options.retryDelay || 1000);
          return operation();
        }
      }
      
      // Log and report
      this.logError(error);
      
      if (options.fallback) {
        return options.fallback();
      }
      
      throw error;
    }
  }
}
```

## Performance Optimization

### Batch Operations

```typescript
export class BatchProcessor {
  private queue: BatchItem[] = [];
  private timer?: NodeJS.Timeout;
  
  constructor(
    private processor: (items: BatchItem[]) => Promise<void>,
    private options: BatchOptions = {}
  ) {}
  
  add(item: BatchItem): void {
    this.queue.push(item);
    
    if (this.queue.length >= (this.options.maxSize || 50)) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }
  
  private scheduleFlush(): void {
    if (this.timer) return;
    
    this.timer = setTimeout(() => {
      this.flush();
    }, this.options.delay || 100);
  }
  
  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    
    if (this.queue.length === 0) return;
    
    const items = this.queue.splice(0);
    await this.processor(items);
  }
}
```

### Streaming Results

```typescript
export class StreamingSearch {
  async* searchStream(
    query: string,
    options: SearchOptions
  ): AsyncGenerator<Memory, void, unknown> {
    let offset = 0;
    const limit = options.limit || 20;
    
    while (true) {
      const results = await this.client.call('search_hybrid', {
        query,
        offset,
        limit
      });
      
      if (results.length === 0) break;
      
      for (const result of results) {
        yield result;
      }
      
      if (results.length < limit) break;
      offset += limit;
    }
  }
}
```

## Security Considerations

### Input Validation

```typescript
export class InputValidator {
  static validateMemoryContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new Error('Memory content cannot be empty');
    }
    
    if (content.length > 100000) {
      throw new Error('Memory content too large');
    }
    
    // Check for malicious patterns
    const suspicious = [
      /<script/i,
      /javascript:/i,
      /data:text\/html/i
    ];
    
    for (const pattern of suspicious) {
      if (pattern.test(content)) {
        throw new Error('Invalid content detected');
      }
    }
  }
}
```

### Secure Storage

```typescript
export class SecureStorage {
  private keytar = require('keytar');
  private serviceName = 'vscode-cognitive-memory';
  
  async storeCredential(key: string, value: string): Promise<void> {
    await this.keytar.setPassword(this.serviceName, key, value);
  }
  
  async getCredential(key: string): Promise<string | null> {
    return this.keytar.getPassword(this.serviceName, key);
  }
  
  async deleteCredential(key: string): Promise<void> {
    await this.keytar.deletePassword(this.serviceName, key);
  }
}
```

## Testing Integration

### Mock Client

```typescript
export class MockMCPClient extends MCPClient {
  private responses = new Map<string, any>();
  
  setResponse(method: string, response: any): void {
    this.responses.set(method, response);
  }
  
  async call<T>(method: string, params?: any): Promise<T> {
    const response = this.responses.get(method);
    
    if (!response) {
      throw new Error(`No mock response for ${method}`);
    }
    
    if (typeof response === 'function') {
      return response(params);
    }
    
    return response;
  }
}
```

### Integration Tests

```typescript
describe('Memory Service Integration', () => {
  let service: MemoryService;
  let mockClient: MockMCPClient;
  
  beforeEach(() => {
    mockClient = new MockMCPClient();
    service = new MemoryService(mockClient);
  });
  
  it('should enhance metadata with VS Code context', async () => {
    mockClient.setResponse('store_memory', (params: any) => {
      expect(params.metadata).toHaveProperty('file');
      expect(params.metadata).toHaveProperty('line');
      expect(params.metadata).toHaveProperty('language');
      return { stored: true, id: 'test-123' };
    });
    
    await service.storeMemory('test content');
  });
});
```