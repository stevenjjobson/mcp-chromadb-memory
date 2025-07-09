/**
 * Conversational Memory Manager for CoachNTT
 * Unified memory management optimized for conversational AI about codebases
 */

import { ChromaClient } from 'chromadb';
import { OpenAI } from 'openai';
import { Config } from './config.js';
import { PostgresClient, getPostgresClient } from './db/postgres-client.js';
import { MemoryRepository } from './db/memory-repository.js';
import { SymbolRepository } from './db/symbol-repository.js';
import { FileRepository } from './db/file-repository.js';
import { HybridSearchService } from './db/hybrid-search-service.js';
import { TokenManager } from './utils/token-manager.js';
import { sanitizeMetadata } from './utils/metadata-validator.js';
import { withRetry } from './utils/retry-helper.js';
import { HybridMemoryManager } from './memory-manager-hybrid.js';

// Memory contexts optimized for conversational AI
export type ConversationContext = 
  | 'conversation_flow'    // Track conversation history and context
  | 'code_understanding'   // Code explanations and insights
  | 'decision_history'     // Architectural and design decisions
  | 'user_preference'      // User's coding style and preferences
  | 'task_context'        // Current task and goals
  | 'code_symbol'         // Specific code elements
  | 'code_pattern'        // Recognized patterns
  | 'code_relationship'   // How code elements relate
  | 'general';            // General knowledge

export interface Memory {
  id: string;
  content: string;
  context: ConversationContext;
  importance: number;
  timestamp: string;
  metadata: Record<string, any>;
  accessCount: number;
  lastAccessed: string;
  conversationId?: string;  // Link memories to conversations
  threadId?: string;        // Support conversation threading
  tier?: 'working' | 'session' | 'longterm';
}

export interface MemoryScore {
  memory: Memory;
  semanticScore: number;
  recencyScore: number;
  importanceScore: number;
  frequencyScore: number;
  conversationRelevance: number;  // New: relevance to current conversation
  totalScore: number;
}

export interface ConversationSession {
  id: string;
  startTime: Date;
  lastActivity: Date;
  currentContext: string;
  activeThreads: string[];
  metadata: Record<string, any>;
}

export class ConversationalMemoryManager extends HybridMemoryManager {
  private tokenManager: TokenManager;
  
  // Conversation tracking
  private activeSession: ConversationSession | null = null;
  private conversationHistory: Map<string, Memory[]> = new Map();
  
  // Memory weights optimized for conversational AI
  private readonly WEIGHT_SEMANTIC = 0.35;      // Slightly reduced
  private readonly WEIGHT_RECENCY = 0.25;       // Recent context matters
  private readonly WEIGHT_IMPORTANCE = 0.15;    
  private readonly WEIGHT_FREQUENCY = 0.10;     
  private readonly WEIGHT_CONVERSATION = 0.15;  // New: conversation relevance
  
  constructor(config: Config) {
    super(config);
    this.tokenManager = new TokenManager();
  }
  
  async initialize(): Promise<void> {
    await super.initialize();
    console.error('Conversational features initialized');
    
    // Start a default conversation session
    this.startConversation();
  }
  
  /**
   * Start a new conversation session
   */
  startConversation(metadata: Record<string, any> = {}): ConversationSession {
    const session: ConversationSession = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: new Date(),
      lastActivity: new Date(),
      currentContext: 'general',
      activeThreads: [],
      metadata
    };
    
    this.activeSession = session;
    this.conversationHistory.set(session.id, []);
    
    console.error(`Started conversation: ${session.id}`);
    return session;
  }
  
  /**
   * Store memory with conversation awareness
   */
  async storeMemory(
    content: string,
    context: string = 'general',
    metadata: Record<string, any> = {}
  ): Promise<any> {
    // Add conversation metadata
    const enrichedMetadata = {
      ...metadata,
      conversationId: this.activeSession?.id,
      conversationTime: new Date().toISOString()
    };
    
    // Store using parent class method
    const result = await super.storeMemory(content, context, enrichedMetadata);
    
    // Track in conversation history
    if (this.activeSession && result.stored) {
      const memory: Memory = {
        id: result.id!,
        content,
        context: context as ConversationContext,
        importance: result.importance!,
        timestamp: new Date().toISOString(),
        metadata: enrichedMetadata,
        accessCount: 0,
        lastAccessed: new Date().toISOString(),
        conversationId: this.activeSession.id
      };
      
      const history = this.conversationHistory.get(this.activeSession.id) || [];
      history.push(memory);
      this.conversationHistory.set(this.activeSession.id, history);
    }
    
    return result;
  }
  
  /**
   * Recall memories with conversation-aware scoring
   */
  async recallMemories(
    query: string,
    context?: string,
    limit: number = 10
  ): Promise<MemoryScore[]> {
    // Get base results from parent
    const baseResults = await super.searchSemantic(query, context, limit * 2);
    
    // Re-score with conversation awareness
    const scoredMemories = baseResults.map(result => {
      const memory = this.enrichMemory(result.memory);
      return this.calculateConversationalScores(memory, result, query);
    });
    
    // Sort by total score and limit
    return scoredMemories
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit);
  }
  
  /**
   * Calculate scores including conversation relevance
   */
  private calculateConversationalScores(
    memory: Memory, 
    baseResult: any, 
    query: string
  ): MemoryScore {
    // Use base scores from parent result
    const semanticScore = baseResult.semanticScore;
    const recencyScore = baseResult.recencyScore;
    const importanceScore = baseResult.importanceScore;
    const frequencyScore = baseResult.frequencyScore;
    
    // Calculate conversation relevance
    let conversationRelevance = 0;
    if (this.activeSession && memory.conversationId === this.activeSession.id) {
      conversationRelevance = 0.8;  // High relevance for same conversation
    } else if (memory.conversationId) {
      conversationRelevance = 0.3;  // Some relevance for other conversations
    }
    
    // Additional boost for recent conversation context
    const conversationHistory = this.conversationHistory.get(this.activeSession?.id || '');
    if (conversationHistory && conversationHistory.length > 0) {
      const recentMemories = conversationHistory.slice(-5);
      if (recentMemories.some(m => this.areRelated(m.content, memory.content))) {
        conversationRelevance = Math.min(1, conversationRelevance + 0.2);
      }
    }
    
    const totalScore = 
      this.WEIGHT_SEMANTIC * semanticScore +
      this.WEIGHT_RECENCY * recencyScore +
      this.WEIGHT_IMPORTANCE * importanceScore +
      this.WEIGHT_FREQUENCY * frequencyScore +
      this.WEIGHT_CONVERSATION * conversationRelevance;
    
    return {
      memory,
      semanticScore,
      recencyScore,
      importanceScore,
      frequencyScore,
      conversationRelevance,
      totalScore
    };
  }
  
  /**
   * Get conversation context for current session
   */
  async getConversationContext(maxTokens: number = 1000): Promise<string> {
    if (!this.activeSession) {
      return 'No active conversation.';
    }
    
    const history = this.conversationHistory.get(this.activeSession.id) || [];
    const recentHistory = history.slice(-20);  // Last 20 interactions
    
    if (recentHistory.length === 0) {
      return 'Conversation just started. No previous context.';
    }
    
    // Build context summary
    const contextParts = recentHistory.map(m => ({
      role: m.context.includes('code') ? 'code' : 'discussion',
      content: m.content,
      importance: m.importance
    }));
    
    // Use token manager to compress
    const compressed = await this.tokenManager.compressContext(contextParts, {
      maxTokens,
      preserveStructure: true,
      smartFiltering: true
    });
    
    return `Conversation Context (${this.activeSession.id}):\n${compressed}`;
  }
  
  /**
   * Enrich memory with conversation context
   */
  private enrichMemory(baseMemory: any): Memory {
    return {
      id: baseMemory.id,
      content: baseMemory.content,
      context: (baseMemory.context || 'general') as ConversationContext,
      importance: baseMemory.importance,
      timestamp: baseMemory.timestamp,
      metadata: baseMemory.metadata || {},
      accessCount: baseMemory.accessCount || 0,
      lastAccessed: baseMemory.lastAccessed || new Date().toISOString(),
      conversationId: baseMemory.metadata?.conversationId,
      threadId: baseMemory.metadata?.threadId,
      tier: baseMemory.tier
    };
  }
  
  /**
   * Check if two pieces of content are related
   */
  private areRelated(content1: string, content2: string): boolean {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    // Jaccard similarity
    return intersection.size / union.size > 0.2;
  }
  
  /**
   * Get conversation statistics
   */
  getConversationStats(): any {
    if (!this.activeSession) {
      return { status: 'No active conversation' };
    }
    
    const history = this.conversationHistory.get(this.activeSession.id) || [];
    const contextCounts = history.reduce((acc, m) => {
      acc[m.context] = (acc[m.context] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      conversationId: this.activeSession.id,
      startTime: this.activeSession.startTime,
      duration: Date.now() - this.activeSession.startTime.getTime(),
      messageCount: history.length,
      contexts: contextCounts,
      activeThreads: this.activeSession.activeThreads.length
    };
  }
}