/**
 * Hybrid Search Service
 * Combines PostgreSQL and ChromaDB search capabilities
 */

import { MemoryRepository, Memory } from './memory-repository.js';
import { ChromaClient, Collection } from 'chromadb';
import OpenAI from 'openai';
import { config } from '../config.js';

export interface SearchOptions {
  context?: string;
  vaultId?: string;
  tier?: string;
  limit?: number;
  includeExact?: boolean;
  includeFullText?: boolean;
  includeSemantic?: boolean;
  exactWeight?: number;
}

export interface SearchResult {
  memory: Memory;
  score: number;
  matchType: 'exact' | 'fulltext' | 'semantic' | 'hybrid';
  highlights?: string[];
}

export class HybridSearchService {
  private openai: OpenAI;
  
  constructor(
    private memoryRepo: MemoryRepository,
    private chromaClient: ChromaClient,
    private collection: Collection
  ) {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }
  
  /**
   * Perform hybrid search combining multiple strategies
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const tasks: Promise<SearchResult[]>[] = [];
    
    // Default options
    const opts = {
      includeExact: options.includeExact ?? true,
      includeFullText: options.includeFullText ?? true,
      includeSemantic: options.includeSemantic ?? true,
      exactWeight: options.exactWeight ?? 0.4,
      limit: options.limit ?? 20,
      ...options
    };
    
    // Execute search strategies in parallel
    if (opts.includeExact && config.postgresReadRatio > 0) {
      tasks.push(this.searchExact(query, opts));
    }
    
    if (opts.includeFullText && config.postgresReadRatio > 0) {
      tasks.push(this.searchFullText(query, opts));
    }
    
    if (opts.includeSemantic) {
      // Decide whether to use PostgreSQL or ChromaDB for semantic search
      if (Math.random() < config.postgresReadRatio) {
        tasks.push(this.searchSemanticPostgres(query, opts));
      } else {
        tasks.push(this.searchSemanticChroma(query, opts));
      }
    }
    
    // Wait for all searches to complete
    const results = await Promise.all(tasks);
    
    // Merge and rank results
    return this.mergeAndRank(results.flat(), opts);
  }
  
  /**
   * Exact string matching in PostgreSQL
   */
  private async searchExact(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const memories = await this.memoryRepo.findByExactMatch(query, {
      context: options.context,
      vaultId: options.vaultId,
      tier: options.tier,
      limit: options.limit
    });
    
    return memories.map(memory => ({
      memory,
      score: 1.0, // Exact matches get highest score
      matchType: 'exact' as const,
      highlights: this.extractHighlights(memory.content, query)
    }));
  }
  
  /**
   * Full-text search in PostgreSQL
   */
  private async searchFullText(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const results = await this.memoryRepo.searchFullText(query, {
      context: options.context,
      vaultId: options.vaultId,
      limit: options.limit
    });
    
    return results.map(result => ({
      memory: result,
      score: result.rank, // Use PostgreSQL's text search rank
      matchType: 'fulltext' as const,
      highlights: this.extractHighlights(result.content, query)
    }));
  }
  
  /**
   * Semantic search using PostgreSQL pgvector
   */
  private async searchSemanticPostgres(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // Generate embedding for query
    const embedding = await this.generateEmbedding(query);
    
    const results = await this.memoryRepo.findBySemantic(embedding, {
      context: options.context,
      vaultId: options.vaultId,
      tier: options.tier,
      limit: options.limit
    });
    
    return results.map(result => ({
      memory: result,
      score: result.similarity,
      matchType: 'semantic' as const
    }));
  }
  
  /**
   * Semantic search using ChromaDB
   */
  private async searchSemanticChroma(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // Build where clause for ChromaDB
    const where: any = {};
    if (options.context) {
      where.context = options.context;
    }
    if (options.vaultId) {
      where.vault_id = options.vaultId;
    }
    
    // Query ChromaDB
    const results = await this.collection.query({
      queryTexts: [query],
      nResults: options.limit || 10,
      where: Object.keys(where).length > 0 ? where : undefined
    });
    
    if (!results.ids || results.ids.length === 0 || results.ids[0].length === 0) {
      return [];
    }
    
    // Fetch full memories from PostgreSQL using IDs
    const searchResults: SearchResult[] = [];
    
    for (let i = 0; i < results.ids[0].length; i++) {
      const id = results.ids[0][i];
      const memory = await this.memoryRepo.findById(id);
      
      if (memory) {
        let score = 0.5; // Default score
        if (results.distances && results.distances[0] && results.distances[0][i] !== null && results.distances[0][i] !== undefined) {
          score = 1 - (results.distances[0][i] as number);
        }
        
        searchResults.push({
          memory,
          score,
          matchType: 'semantic' as const
        });
      }
    }
    
    return searchResults;
  }
  
  /**
   * Merge and rank results from different search strategies
   */
  private mergeAndRank(
    results: SearchResult[], 
    options: SearchOptions
  ): SearchResult[] {
    // Group by memory ID to handle duplicates
    const grouped = new Map<string, SearchResult[]>();
    
    for (const result of results) {
      const id = result.memory.id;
      if (!grouped.has(id)) {
        grouped.set(id, []);
      }
      grouped.get(id)!.push(result);
    }
    
    // Combine scores for duplicates
    const combined: SearchResult[] = [];
    
    for (const [id, group] of grouped) {
      // Calculate combined score
      let combinedScore = 0;
      let hasExact = false;
      let hasFullText = false;
      let hasSemantic = false;
      
      for (const result of group) {
        if (result.matchType === 'exact') {
          hasExact = true;
          combinedScore += result.score * (options.exactWeight || 0.4);
        } else if (result.matchType === 'fulltext') {
          hasFullText = true;
          combinedScore += result.score * 0.3;
        } else if (result.matchType === 'semantic') {
          hasSemantic = true;
          combinedScore += result.score * (1 - (options.exactWeight || 0.4) - 0.3);
        }
      }
      
      // Determine match type
      let matchType: SearchResult['matchType'] = 'hybrid';
      if (hasExact && !hasFullText && !hasSemantic) matchType = 'exact';
      else if (!hasExact && hasFullText && !hasSemantic) matchType = 'fulltext';
      else if (!hasExact && !hasFullText && hasSemantic) matchType = 'semantic';
      
      // Use the first result as template
      const firstResult = group[0];
      combined.push({
        ...firstResult,
        score: combinedScore,
        matchType
      });
    }
    
    // Sort by combined score
    combined.sort((a, b) => b.score - a.score);
    
    // Apply limit
    return combined.slice(0, options.limit || 20);
  }
  
  /**
   * Generate embedding for text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }
  
  /**
   * Extract highlights from content
   */
  private extractHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/);
    
    // Find sentences containing query words
    const sentences = content.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      const hasMatch = words.some(word => lowerSentence.includes(word));
      
      if (hasMatch && sentence.trim().length > 0) {
        highlights.push(sentence.trim());
        if (highlights.length >= 3) break; // Limit to 3 highlights
      }
    }
    
    return highlights;
  }
  
  /**
   * Get search statistics
   */
  async getSearchStats(): Promise<{
    postgresRatio: number;
    chromaRatio: number;
    hybridEnabled: boolean;
  }> {
    return {
      postgresRatio: config.postgresReadRatio,
      chromaRatio: 1 - config.postgresReadRatio,
      hybridEnabled: config.useHybridStorage
    };
  }
}