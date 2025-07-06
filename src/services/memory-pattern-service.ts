import { EnhancedMemoryManager } from '../memory-manager-enhanced.js';

export interface AccessPattern {
  memoryId: string;
  accessCount: number;
  lastAccessed: string;
  averageTimeBetweenAccess: number;
  accessTimes: string[];
  tier: 'hot' | 'warm' | 'cold';
}

export interface PatternAnalysis {
  hotMemories: AccessPattern[];
  warmMemories: AccessPattern[];
  coldMemories: AccessPattern[];
  recommendations: string[];
  stats: {
    totalAccesses: number;
    averageAccessCount: number;
    hotTierPercentage: number;
    warmTierPercentage: number;
    coldTierPercentage: number;
  };
}

export class MemoryPatternService {
  private accessHistory: Map<string, string[]> = new Map();
  private readonly HOT_THRESHOLD = 10; // accesses
  private readonly WARM_THRESHOLD = 3; // accesses
  private readonly RECENCY_HOT_HOURS = 24;
  private readonly RECENCY_WARM_DAYS = 7;
  
  constructor(private memoryManager: EnhancedMemoryManager) {}
  
  // Track memory access
  async trackAccess(memoryId: string): Promise<void> {
    const now = new Date().toISOString();
    
    if (!this.accessHistory.has(memoryId)) {
      this.accessHistory.set(memoryId, []);
    }
    
    this.accessHistory.get(memoryId)!.push(now);
    
    // Keep only last 100 access times per memory
    const history = this.accessHistory.get(memoryId)!;
    if (history.length > 100) {
      this.accessHistory.set(memoryId, history.slice(-100));
    }
  }
  
  // Analyze access patterns
  async analyzePatterns(): Promise<PatternAnalysis> {
    const stats = await this.memoryManager.getMemoryStats();
    const patterns: AccessPattern[] = [];
    
    // Get all memories with their access patterns
    // Note: In a real implementation, we'd fetch this from the memory manager
    // For now, we'll use the tracked history
    
    for (const [memoryId, accessTimes] of this.accessHistory.entries()) {
      const pattern = this.calculateAccessPattern(memoryId, accessTimes);
      patterns.push(pattern);
    }
    
    // Categorize by tier
    const hotMemories = patterns.filter(p => p.tier === 'hot');
    const warmMemories = patterns.filter(p => p.tier === 'warm');
    const coldMemories = patterns.filter(p => p.tier === 'cold');
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      hotMemories,
      warmMemories,
      coldMemories,
      stats
    );
    
    // Calculate statistics
    const totalAccesses = patterns.reduce((sum, p) => sum + p.accessCount, 0);
    const averageAccessCount = patterns.length > 0 
      ? totalAccesses / patterns.length 
      : 0;
    
    return {
      hotMemories,
      warmMemories,
      coldMemories,
      recommendations,
      stats: {
        totalAccesses,
        averageAccessCount,
        hotTierPercentage: (hotMemories.length / patterns.length) * 100,
        warmTierPercentage: (warmMemories.length / patterns.length) * 100,
        coldTierPercentage: (coldMemories.length / patterns.length) * 100
      }
    };
  }
  
  // Calculate access pattern for a memory
  private calculateAccessPattern(
    memoryId: string,
    accessTimes: string[]
  ): AccessPattern {
    const now = Date.now();
    const accessCount = accessTimes.length;
    const lastAccessed = accessTimes[accessTimes.length - 1] || new Date().toISOString();
    
    // Calculate average time between accesses
    let averageTimeBetweenAccess = 0;
    if (accessTimes.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < accessTimes.length; i++) {
        const interval = new Date(accessTimes[i]).getTime() - 
                        new Date(accessTimes[i - 1]).getTime();
        intervals.push(interval);
      }
      averageTimeBetweenAccess = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }
    
    // Determine tier based on access count and recency
    const hoursSinceLastAccess = (now - new Date(lastAccessed).getTime()) / (1000 * 60 * 60);
    const daysSinceLastAccess = hoursSinceLastAccess / 24;
    
    let tier: 'hot' | 'warm' | 'cold';
    if (accessCount >= this.HOT_THRESHOLD || hoursSinceLastAccess < this.RECENCY_HOT_HOURS) {
      tier = 'hot';
    } else if (accessCount >= this.WARM_THRESHOLD || daysSinceLastAccess < this.RECENCY_WARM_DAYS) {
      tier = 'warm';
    } else {
      tier = 'cold';
    }
    
    return {
      memoryId,
      accessCount,
      lastAccessed,
      averageTimeBetweenAccess,
      accessTimes,
      tier
    };
  }
  
  // Generate recommendations based on patterns
  private generateRecommendations(
    hotMemories: AccessPattern[],
    warmMemories: AccessPattern[],
    coldMemories: AccessPattern[],
    stats: any
  ): string[] {
    const recommendations: string[] = [];
    
    // Hot tier recommendations
    if (hotMemories.length > 20) {
      recommendations.push(
        `Consider implementing in-memory caching for ${hotMemories.length} hot memories to improve performance`
      );
    }
    
    // Cold tier recommendations
    if (coldMemories.length > stats.totalMemories * 0.7) {
      recommendations.push(
        `${coldMemories.length} memories (${(coldMemories.length / stats.totalMemories * 100).toFixed(1)}%) are cold. Consider archiving or compressing these memories`
      );
    }
    
    // Access pattern recommendations
    const frequentlyAccessedRecently = hotMemories.filter(m => {
      const hoursSince = (Date.now() - new Date(m.lastAccessed).getTime()) / (1000 * 60 * 60);
      return hoursSince < 1 && m.accessCount > 20;
    });
    
    if (frequentlyAccessedRecently.length > 0) {
      recommendations.push(
        `${frequentlyAccessedRecently.length} memories are being accessed very frequently. Consider keeping them in working memory`
      );
    }
    
    // Memory growth recommendations
    if (stats.totalMemories > 1000) {
      recommendations.push(
        `Memory count is high (${stats.totalMemories}). Implement memory consolidation to merge similar memories`
      );
    }
    
    return recommendations;
  }
  
  // Get memories by tier
  async getMemoriesByTier(tier: 'hot' | 'warm' | 'cold'): Promise<string[]> {
    const analysis = await this.analyzePatterns();
    
    switch (tier) {
      case 'hot':
        return analysis.hotMemories.map(m => m.memoryId);
      case 'warm':
        return analysis.warmMemories.map(m => m.memoryId);
      case 'cold':
        return analysis.coldMemories.map(m => m.memoryId);
    }
  }
  
  // Predict next access time
  predictNextAccess(memoryId: string): { prediction: Date | null; confidence: number } {
    const accessTimes = this.accessHistory.get(memoryId);
    
    if (!accessTimes || accessTimes.length < 2) {
      return { prediction: null, confidence: 0 };
    }
    
    // Simple prediction based on average interval
    const intervals: number[] = [];
    for (let i = 1; i < accessTimes.length; i++) {
      intervals.push(
        new Date(accessTimes[i]).getTime() - new Date(accessTimes[i - 1]).getTime()
      );
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const lastAccess = new Date(accessTimes[accessTimes.length - 1]);
    const prediction = new Date(lastAccess.getTime() + avgInterval);
    
    // Calculate confidence based on interval consistency
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - avgInterval, 2);
    }, 0) / intervals.length;
    
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgInterval;
    
    // Higher consistency = higher confidence
    const confidence = Math.max(0, Math.min(1, 1 - coefficientOfVariation));
    
    return { prediction, confidence };
  }
}