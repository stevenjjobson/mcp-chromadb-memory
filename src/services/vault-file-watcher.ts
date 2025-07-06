import * as chokidar from 'chokidar';
import * as path from 'path';
import { VaultIndexService } from './vault-index-service.js';
import { WatchEvent, IndexUpdate } from '../types/vault-index.types.js';

export class VaultFileWatcher {
  private watcher?: chokidar.FSWatcher;
  private updateQueue: IndexUpdate[] = [];
  private updateTimer?: NodeJS.Timeout;
  private updateDelay = 5000; // 5 seconds delay to batch updates
  
  constructor(
    private vaultPath: string,
    private indexService: VaultIndexService
  ) {}
  
  async start(): Promise<void> {
    console.error(`Starting vault file watcher for: ${this.vaultPath}`);
    
    // Initialize watcher
    this.watcher = chokidar.watch(this.vaultPath, {
      ignored: [
        /(^|[\/\\])\../, // ignore dotfiles
        /node_modules/,
        /\.git/,
        /VAULT_INDEX\.md$/ // ignore the index file itself
      ],
      persistent: true,
      ignoreInitial: true, // don't fire events for existing files on startup
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });
    
    // Set up event handlers
    this.watcher
      .on('add', (filePath) => this.handleFileEvent('add', filePath))
      .on('change', (filePath) => this.handleFileEvent('change', filePath))
      .on('unlink', (filePath) => this.handleFileEvent('unlink', filePath))
      .on('addDir', (dirPath) => this.handleFileEvent('addDir', dirPath))
      .on('unlinkDir', (dirPath) => this.handleFileEvent('unlinkDir', dirPath))
      .on('error', (error) => console.error('Watcher error:', error))
      .on('ready', () => console.error('Vault file watcher ready'));
  }
  
  private handleFileEvent(type: WatchEvent['type'], filePath: string): void {
    const relativePath = path.relative(this.vaultPath, filePath);
    
    const event: WatchEvent = {
      type,
      path: relativePath,
      timestamp: new Date()
    };
    
    // Determine which section of the index needs updating
    const section = this.determineIndexSection(relativePath);
    
    const update: IndexUpdate = {
      section,
      trigger: event,
      timestamp: new Date()
    };
    
    // Add to update queue
    this.updateQueue.push(update);
    
    // Schedule batch update
    this.scheduleUpdate();
  }
  
  private determineIndexSection(filePath: string): IndexUpdate['section'] {
    // Determine which part of the index should be updated based on file path
    if (filePath.includes('Sessions/') || filePath.includes('Claude Code Sessions/')) {
      return 'context';
    } else if (filePath.includes('Tasks/') || filePath.includes('Task-Management/')) {
      return 'context';
    } else if (filePath.includes('Templates/')) {
      return 'stats';
    } else if (filePath.includes('.md') || filePath.includes('.txt')) {
      return 'stats';
    }
    
    // Default to updating stats section
    return 'stats';
  }
  
  private scheduleUpdate(): void {
    // Clear existing timer
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    // Schedule new update
    this.updateTimer = setTimeout(() => {
      this.processBatchUpdate();
    }, this.updateDelay);
  }
  
  private async processBatchUpdate(): Promise<void> {
    if (this.updateQueue.length === 0) return;
    
    // Get unique sections that need updating
    const sectionsToUpdate = new Set(this.updateQueue.map(u => u.section));
    
    // Log the update
    console.error(`Processing ${this.updateQueue.length} file changes, updating sections: ${Array.from(sectionsToUpdate).join(', ')}`);
    
    // Clear the queue
    this.updateQueue = [];
    
    try {
      // If 'all' is in sections or we have multiple sections, do a full update
      if (sectionsToUpdate.has('all') || sectionsToUpdate.size > 2) {
        await this.indexService.generateAndSaveIndex();
      } else {
        // Otherwise, do a partial update (future enhancement)
        // For now, just regenerate the full index
        await this.indexService.generateAndSaveIndex();
      }
      
      console.error('Vault index updated successfully');
    } catch (error) {
      console.error('Failed to update vault index:', error);
    }
  }
  
  async stop(): Promise<void> {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    if (this.watcher) {
      await this.watcher.close();
      console.error('Vault file watcher stopped');
    }
  }
  
  // Manual trigger for immediate update
  async forceUpdate(): Promise<void> {
    console.error('Forcing vault index update...');
    await this.indexService.generateAndSaveIndex();
  }
}

// Helper class for more advanced file analysis
export class VaultFileAnalyzer {
  static async analyzeFileChange(filePath: string, changeType: WatchEvent['type']): Promise<{
    impactLevel: 'high' | 'medium' | 'low';
    affectedSections: string[];
    description: string;
  }> {
    const fileName = path.basename(filePath);
    const dirName = path.dirname(filePath);
    
    // High impact changes
    if (fileName === 'README.md' || fileName === 'Index.md') {
      return {
        impactLevel: 'high',
        affectedSections: ['navigation', 'stats'],
        description: 'Main documentation file changed'
      };
    }
    
    if (dirName.includes('Architecture') || dirName.includes('decisions')) {
      return {
        impactLevel: 'high',
        affectedSections: ['context', 'navigation'],
        description: 'Architecture decision changed'
      };
    }
    
    // Medium impact changes
    if (dirName.includes('Sessions') || dirName.includes('Tasks')) {
      return {
        impactLevel: 'medium',
        affectedSections: ['context'],
        description: 'Session or task updated'
      };
    }
    
    if (fileName.endsWith('.md')) {
      return {
        impactLevel: 'medium',
        affectedSections: ['stats'],
        description: 'Documentation file changed'
      };
    }
    
    // Low impact changes
    return {
      impactLevel: 'low',
      affectedSections: ['stats'],
      description: 'General file change'
    };
  }
}