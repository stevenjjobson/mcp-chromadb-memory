/**
 * Shared memory types for CoachNTT
 * Used by both MCP server and VSCode extension
 */

export interface Memory {
  id: string;
  content: string;
  timestamp: number;
  context?: string;
  metadata?: {
    conversationId?: string;
    userId?: string;
    projectId?: string;
    tags?: string[];
    source?: string;
    language?: string;
  };
  importance?: number;
  tier?: 'working' | 'session' | 'long_term';
  lastAccessed?: number;
  accessCount?: number;
}

export interface ConversationContext {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  turnCount: number;
  memories: string[]; // Memory IDs
  topics: string[];
  codeFiles?: string[];
  activeTask?: string;
}

export interface MemorySearchRequest {
  query: string;
  limit?: number;
  context?: string;
  filters?: {
    startDate?: number;
    endDate?: number;
    tags?: string[];
    tier?: string;
    minImportance?: number;
  };
  searchType?: 'semantic' | 'exact' | 'hybrid';
  hybridWeights?: {
    exact: number;
    semantic: number;
  };
}

export interface MemorySearchResult {
  memory: Memory;
  score: number;
  matchType: 'semantic' | 'exact' | 'both';
  highlights?: string[];
}

export interface MemoryStats {
  totalMemories: number;
  byTier: {
    working: number;
    session: number;
    long_term: number;
  };
  byContext: Record<string, number>;
  averageImportance: number;
  lastUpdated: number;
  storageUsed: number; // bytes
}