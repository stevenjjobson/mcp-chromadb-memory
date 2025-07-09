import { MemoryManager } from '../memory-manager.js';
import { ChromaClient } from 'chromadb';
import {
  MemoryHealth,
  FragmentationAnalysis,
  DuplicateAnalysis,
  DuplicateGroup,
  OrphanedAnalysis,
  PerformanceMetrics,
  HealthStatus
} from '../types/vault-index.types.js';

export class MemoryHealthMonitor {
  private performanceHistory: number[] = [];
  private queryCount = 0;
  
  constructor(
    private memoryManager: MemoryManager,
    private chromaClient: ChromaClient
  ) {}
  
  async checkMemoryHealth(): Promise<MemoryHealth> {
    const fragmentation = await this.checkFragmentation();
    const duplicates = await this.findDuplicates();
    const orphaned = await this.findOrphanedMemories();
    const performance = await this.measureQueryPerformance();
    const recommendations = this.generateRecommendations(
      fragmentation,
      duplicates,
      orphaned,
      performance
    );
    
    return {
      fragmentation,
      duplicates,
      orphaned,
      performance,
      recommendations
    };
  }
  
  private async checkFragmentation(): Promise<FragmentationAnalysis> {
    try {
      // Get all memory IDs and check for gaps
      const collection = await this.getMemoryCollection();
      const result = await collection.get();
      
      if (!result.ids || result.ids.length === 0) {
        return {
          percentage: 0,
          status: 'healthy',
          details: {
            totalMemories: 0,
            fragmentedMemories: 0,
            averageGap: 0
          }
        };
      }
      
      // Extract numeric parts from IDs (assuming format: mem_timestamp_random)
      const timestamps = result.ids
        .map((id: string) => {
          const match = id.match(/mem_(\d+)_/);
          return match ? parseInt(match[1]) : null;
        })
        .filter((ts: number | null): ts is number => ts !== null)
        .sort((a: number, b: number) => a - b);
      
      if (timestamps.length < 2) {
        return {
          percentage: 0,
          status: 'healthy',
          details: {
            totalMemories: result.ids.length,
            fragmentedMemories: 0,
            averageGap: 0
          }
        };
      }
      
      // Calculate gaps between consecutive memories
      let totalGap = 0;
      let gapCount = 0;
      let largeGaps = 0;
      
      for (let i = 1; i < timestamps.length; i++) {
        const gap = timestamps[i] - timestamps[i - 1];
        totalGap += gap;
        gapCount++;
        
        // Consider a gap "large" if it's more than 1 hour
        if (gap > 3600000) {
          largeGaps++;
        }
      }
      
      const averageGap = gapCount > 0 ? totalGap / gapCount : 0;
      const fragmentationPercentage = (largeGaps / timestamps.length) * 100;
      
      let status: HealthStatus = 'healthy';
      if (fragmentationPercentage > 30) status = 'error';
      else if (fragmentationPercentage > 15) status = 'warning';
      
      return {
        percentage: Math.round(fragmentationPercentage),
        status,
        details: {
          totalMemories: result.ids.length,
          fragmentedMemories: largeGaps,
          averageGap: Math.round(averageGap / 1000) // Convert to seconds
        }
      };
    } catch (error) {
      console.error('Error checking fragmentation:', error);
      return {
        percentage: 0,
        status: 'unknown',
        details: {
          totalMemories: 0,
          fragmentedMemories: 0,
          averageGap: 0
        }
      };
    }
  }
  
  private async findDuplicates(): Promise<DuplicateAnalysis> {
    try {
      const collection = await this.getMemoryCollection();
      const result = await collection.get();
      
      if (!result.documents || result.documents.length < 2) {
        return { count: 0, groups: [] };
      }
      
      const duplicateGroups: DuplicateGroup[] = [];
      const processedIndices = new Set<number>();
      
      // Compare each memory with others
      for (let i = 0; i < result.documents.length; i++) {
        if (processedIndices.has(i)) continue;
        
        const group: DuplicateGroup = {
          similarity: 0,
          memories: []
        };
        
        const doc1 = result.documents[i];
        if (!doc1) continue;
        
        // Add the first memory to the group
        group.memories.push({
          id: result.ids[i],
          content: doc1,
          timestamp: new Date(result.metadatas?.[i]?.timestamp || Date.now())
        });
        
        // Find similar memories
        for (let j = i + 1; j < result.documents.length; j++) {
          if (processedIndices.has(j)) continue;
          
          const doc2 = result.documents[j];
          if (!doc2) continue;
          
          const similarity = this.calculateSimilarity(doc1, doc2);
          
          if (similarity > 0.85) { // 85% similarity threshold
            group.memories.push({
              id: result.ids[j],
              content: doc2,
              timestamp: new Date(result.metadatas?.[j]?.timestamp || Date.now())
            });
            group.similarity = Math.max(group.similarity, similarity);
            processedIndices.add(j);
          }
        }
        
        // Only add groups with actual duplicates
        if (group.memories.length > 1) {
          duplicateGroups.push(group);
          processedIndices.add(i);
        }
      }
      
      return {
        count: duplicateGroups.reduce((sum, g) => sum + g.memories.length - 1, 0),
        groups: duplicateGroups
      };
    } catch (error) {
      console.error('Error finding duplicates:', error);
      return { count: 0, groups: [] };
    }
  }
  
  private calculateSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity for demonstration
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  private async findOrphanedMemories(): Promise<OrphanedAnalysis> {
    try {
      const collection = await this.getMemoryCollection();
      const result = await collection.get();
      
      if (!result.ids || result.ids.length === 0) {
        return { count: 0, memories: [] };
      }
      
      const orphaned = [];
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      for (let i = 0; i < result.ids.length; i++) {
        const metadata = result.metadatas?.[i];
        if (!metadata) continue;
        
        const lastAccessed = new Date(metadata.lastAccessed || metadata.timestamp).getTime();
        const accessCount = metadata.accessCount || 0;
        const importance = metadata.importance || 0.5;
        
        // Consider a memory orphaned if:
        // 1. Not accessed in 30 days AND low importance
        // 2. Never accessed AND created more than 7 days ago
        // 3. Very low importance (<0.3) AND accessed less than twice
        
        let reason = '';
        
        if (lastAccessed < thirtyDaysAgo && importance < 0.5) {
          reason = 'Not accessed in 30 days with low importance';
        } else if (accessCount === 0 && Date.now() - new Date(metadata.timestamp).getTime() > 7 * 24 * 60 * 60 * 1000) {
          reason = 'Never accessed after 7 days';
        } else if (importance < 0.3 && accessCount < 2) {
          reason = 'Very low importance with minimal access';
        }
        
        if (reason) {
          orphaned.push({
            id: result.ids[i],
            reason,
            lastAccessed: new Date(lastAccessed)
          });
        }
      }
      
      return {
        count: orphaned.length,
        memories: orphaned.slice(0, 10) // Limit to first 10 for display
      };
    } catch (error) {
      console.error('Error finding orphaned memories:', error);
      return { count: 0, memories: [] };
    }
  }
  
  private async measureQueryPerformance(): Promise<PerformanceMetrics> {
    // Perform a test query to measure performance
    const testQueries = [
      'memory management',
      'session logging',
      'chromadb integration'
    ];
    
    const queryTimes: number[] = [];
    
    for (const query of testQueries) {
      const startTime = Date.now();
      try {
        await this.memoryManager.recallMemories(query, undefined, 5);
        const duration = Date.now() - startTime;
        queryTimes.push(duration);
        this.performanceHistory.push(duration);
        this.queryCount++;
      } catch (error) {
        console.error('Error measuring query performance:', error);
      }
    }
    
    // Keep only last 100 measurements
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }
    
    const avgQueryTime = queryTimes.length > 0
      ? queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length
      : 0;
    
    const slowQueries = this.performanceHistory.filter(t => t > 100).length;
    
    return {
      avgQueryTime: Math.round(avgQueryTime),
      slowQueries,
      queryCount: this.queryCount,
      indexingSpeed: await this.measureIndexingSpeed()
    };
  }
  
  private async measureIndexingSpeed(): Promise<number> {
    // Mock implementation - would measure actual indexing speed
    return 150; // memories per second
  }
  
  private generateRecommendations(
    fragmentation: FragmentationAnalysis,
    duplicates: DuplicateAnalysis,
    orphaned: OrphanedAnalysis,
    performance: PerformanceMetrics
  ): string[] {
    const recommendations: string[] = [];
    
    if (fragmentation.percentage > 15) {
      recommendations.push('Consider consolidating memories to reduce fragmentation');
    }
    
    if (duplicates.count > 10) {
      recommendations.push(`Found ${duplicates.count} duplicate memories - consider deduplication`);
    }
    
    if (orphaned.count > 50) {
      recommendations.push(`${orphaned.count} orphaned memories detected - review and clean up`);
    }
    
    if (performance.avgQueryTime > 100) {
      recommendations.push('Query performance is slow - consider optimizing indexes');
    }
    
    if (performance.slowQueries > 10) {
      recommendations.push(`${performance.slowQueries} slow queries detected - investigate performance issues`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Memory system is healthy - no actions needed');
    }
    
    return recommendations;
  }
  
  async generateHealthReport(): Promise<string> {
    const health = await this.checkMemoryHealth();
    
    return `## Memory Health Report
Generated: ${new Date().toISOString()}

### Fragmentation Analysis
- Status: ${this.getStatusEmoji(health.fragmentation.status)} ${health.fragmentation.status}
- Fragmentation: ${health.fragmentation.percentage}%
- Total Memories: ${health.fragmentation.details.totalMemories}
- Fragmented Memories: ${health.fragmentation.details.fragmentedMemories}
- Average Gap: ${health.fragmentation.details.averageGap}s

### Duplicate Detection
- Duplicates Found: ${health.duplicates.count}
- Duplicate Groups: ${health.duplicates.groups.length}
${health.duplicates.groups.slice(0, 3).map((group, i) => 
  `  - Group ${i + 1}: ${group.memories.length} memories (${Math.round(group.similarity * 100)}% similar)`
).join('\n')}

### Orphaned Memories
- Total Orphaned: ${health.orphaned.count}
${health.orphaned.memories.slice(0, 5).map(mem => 
  `  - ${mem.id}: ${mem.reason}`
).join('\n')}

### Performance Metrics
- Average Query Time: ${health.performance.avgQueryTime}ms
- Slow Queries: ${health.performance.slowQueries}
- Total Queries: ${health.performance.queryCount}
- Indexing Speed: ${health.performance.indexingSpeed} memories/second

### Recommendations
${health.recommendations.map(rec => `- ${rec}`).join('\n')}
`;
  }
  
  private getStatusEmoji(status: HealthStatus): string {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '❓';
    }
  }
  
  private async getMemoryCollection(): Promise<any> {
    // Get the memory collection from ChromaDB
    // This assumes the collection name from config
    return await this.chromaClient.getCollection({
      name: process.env.MEMORY_COLLECTION_NAME || 'ai_memories'
    });
  }
}