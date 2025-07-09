import { promises as fs } from 'fs';
import * as path from 'path';
import { gzipSync, gunzipSync } from 'zlib';
import { VaultManager } from './vault-manager.js';
import { EnhancedMemoryManager } from './memory-manager-enhanced.js';
import { HybridMemoryManager } from './memory-manager-hybrid.js';
import {
  StateCapture,
  WorkingContext,
  StateMetadata,
  StateDiff
} from './types/platform.types.js';

// Generate unique ID similar to other parts of the codebase
const generateId = (prefix: string = 'state'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * StateManager handles context capture and restoration
 * Preserves complete working state across sessions
 */
export class StateManager {
  private statesPath: string;
  private vaultManager: VaultManager;
  private memoryManager: EnhancedMemoryManager | HybridMemoryManager;
  private maxStatesPerVault: number;
  private compressionEnabled: boolean;

  constructor(
    vaultManager: VaultManager,
    memoryManager: EnhancedMemoryManager | HybridMemoryManager,
    options: {
      statesPath?: string;
      maxStatesPerVault?: number;
      compressionEnabled?: boolean;
    } = {}
  ) {
    this.vaultManager = vaultManager;
    this.memoryManager = memoryManager;
    this.statesPath = options.statesPath || '.states';
    this.maxStatesPerVault = options.maxStatesPerVault || 100;
    this.compressionEnabled = options.compressionEnabled ?? true;
  }

  /**
   * Initialize state manager
   */
  async initialize(): Promise<void> {
    try {
      // Create states directory in vault
      const vaultPath = this.vaultManager.getVaultPath();
      const fullStatesPath = path.join(vaultPath, this.statesPath);
      await fs.mkdir(fullStatesPath, { recursive: true });
      
      console.error('StateManager initialized');
    } catch (error) {
      console.error('Failed to initialize StateManager:', error);
      throw error;
    }
  }

  /**
   * Capture current state
   */
  async captureState(
    name: string,
    options: {
      description?: string;
      tags?: string[];
      importance?: number;
      autoCapture?: boolean;
      expiresInDays?: number;
    } = {}
  ): Promise<string> {
    try {
      console.error(`Capturing state: ${name}`);
      
      // Gather working context
      const context = await this.gatherWorkingContext();
      
      // Get memory snapshot
      const memorySnapshot = await this.captureMemorySnapshot();
      
      // Create state metadata
      const metadata: StateMetadata = {
        name,
        description: options.description,
        tags: options.tags || [],
        importance: options.importance || 0.7,
        autoCapture: options.autoCapture || false,
        expiresAt: options.expiresInDays 
          ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
          : undefined
      };
      
      // Create state capture
      const stateId = generateId('state');
      const stateCapture: StateCapture = {
        id: stateId,
        vaultId: this.vaultManager.getActiveVault()?.name || 'default',
        timestamp: new Date(),
        context,
        metadata,
        memorySnapshot,
        compressed: this.compressionEnabled,
        size: 0 // Will be updated after saving
      };
      
      // Save state
      const savedPath = await this.saveState(stateCapture);
      
      // Update size
      const stats = await fs.stat(savedPath);
      stateCapture.size = stats.size;
      
      // Cleanup old states if needed
      await this.cleanupOldStates();
      
      console.error(`State captured: ${stateId} (${(stateCapture.size / 1024).toFixed(1)}KB)`);
      return stateId;
    } catch (error) {
      console.error('Failed to capture state:', error);
      throw error;
    }
  }

  /**
   * Restore state
   */
  async restoreState(stateId: string): Promise<void> {
    try {
      console.error(`Restoring state: ${stateId}`);
      
      // Load state
      const state = await this.loadState(stateId);
      if (!state) {
        throw new Error(`State not found: ${stateId}`);
      }
      
      // Restore working context
      await this.restoreWorkingContext(state.context);
      
      // Restore memory context if available
      if (state.memorySnapshot) {
        await this.restoreMemoryContext(state.memorySnapshot);
      }
      
      console.error(`State restored: ${stateId}`);
    } catch (error) {
      console.error('Failed to restore state:', error);
      throw error;
    }
  }

  /**
   * List available states
   */
  async listStates(vaultId?: string): Promise<StateCapture[]> {
    try {
      const vaultPath = this.vaultManager.getVaultPath();
      const statesPath = path.join(vaultPath, this.statesPath);
      
      // Read all state files
      const files = await fs.readdir(statesPath);
      const stateFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.json.gz'));
      
      // Load and filter states
      const states: StateCapture[] = [];
      for (const file of stateFiles) {
        try {
          const state = await this.loadStateFromFile(path.join(statesPath, file));
          if (state && (!vaultId || state.vaultId === vaultId)) {
            states.push(state);
          }
        } catch (error) {
          console.error(`Failed to load state from ${file}:`, error);
        }
      }
      
      // Sort by timestamp (newest first)
      states.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return states;
    } catch (error) {
      console.error('Failed to list states:', error);
      return [];
    }
  }

  /**
   * Delete a state
   */
  async deleteState(stateId: string): Promise<void> {
    try {
      const vaultPath = this.vaultManager.getVaultPath();
      const statesPath = path.join(vaultPath, this.statesPath);
      
      // Find state file
      const files = await fs.readdir(statesPath);
      const stateFile = files.find(f => f.includes(stateId));
      
      if (!stateFile) {
        throw new Error(`State not found: ${stateId}`);
      }
      
      // Delete file
      await fs.unlink(path.join(statesPath, stateFile));
      console.error(`Deleted state: ${stateId}`);
    } catch (error) {
      console.error('Failed to delete state:', error);
      throw error;
    }
  }

  /**
   * Compare two states
   */
  async diffStates(stateId1: string, stateId2: string): Promise<StateDiff> {
    try {
      // Load both states
      const state1 = await this.loadState(stateId1);
      const state2 = await this.loadState(stateId2);
      
      if (!state1 || !state2) {
        throw new Error('One or both states not found');
      }
      
      // Compare contexts
      const contextDiffs: StateDiff['differences']['context'] = [];
      
      // Compare active files
      const files1 = new Set(state1.context.activeFiles);
      const files2 = new Set(state2.context.activeFiles);
      
      const filesAdded = [...files2].filter(f => !files1.has(f));
      const filesRemoved = [...files1].filter(f => !files2.has(f));
      const filesModified: string[] = []; // Would need file content comparison
      
      // Compare other context fields
      if (state1.context.gitBranch !== state2.context.gitBranch) {
        contextDiffs.push({
          field: 'gitBranch',
          before: state1.context.gitBranch,
          after: state2.context.gitBranch
        });
      }
      
      // Compare memory snapshots
      const memoriesDiff = {
        added: (state2.memorySnapshot?.totalMemories || 0) - (state1.memorySnapshot?.totalMemories || 0),
        removed: 0, // Would need detailed comparison
        modified: 0  // Would need detailed comparison
      };
      
      return {
        stateId1,
        stateId2,
        timestamp: new Date(),
        differences: {
          files: {
            added: filesAdded,
            removed: filesRemoved,
            modified: filesModified
          },
          context: contextDiffs,
          memories: memoriesDiff
        }
      };
    } catch (error) {
      console.error('Failed to diff states:', error);
      throw error;
    }
  }

  /**
   * Gather current working context
   */
  private async gatherWorkingContext(): Promise<WorkingContext> {
    // This is a simplified version - in a real implementation,
    // this would integrate with the IDE/editor to get actual context
    
    const context: WorkingContext = {
      activeFiles: [], // Would be populated from IDE integration
      openTabs: [],    // Would be populated from IDE integration
      currentFile: undefined,
      cursorPosition: undefined,
      recentCommands: [], // Would track recent CLI commands
      environmentVariables: this.getRelevantEnvVars(),
      gitBranch: await this.getGitBranch(),
      gitStatus: await this.getGitStatus()
    };
    
    return context;
  }

  /**
   * Capture memory snapshot
   */
  private async captureMemorySnapshot(): Promise<StateCapture['memorySnapshot']> {
    try {
      const stats = await this.memoryManager.getMemoryStats();
      
      // In a full implementation, would also capture specific memory IDs
      // based on recency and importance
      
      return {
        workingMemoryIds: [], // Would capture recent memory IDs
        sessionMemoryIds: [], // Would capture session memory IDs
        totalMemories: stats.totalMemories
      };
    } catch (error) {
      console.error('Failed to capture memory snapshot:', error);
      return undefined;
    }
  }

  /**
   * Restore working context
   */
  private async restoreWorkingContext(context: WorkingContext): Promise<void> {
    // In a real implementation, this would:
    // - Open the specified files in the IDE
    // - Restore cursor positions
    // - Set environment variables
    // - Switch git branch if needed
    
    console.error('Working context restored:', {
      files: context.activeFiles.length,
      branch: context.gitBranch
    });
  }

  /**
   * Restore memory context
   */
  private async restoreMemoryContext(snapshot: NonNullable<StateCapture['memorySnapshot']>): Promise<void> {
    // In a real implementation, this would:
    // - Prioritize the specified memories for quick access
    // - Potentially pre-load them into working memory
    
    console.error('Memory context restored:', {
      working: snapshot.workingMemoryIds.length,
      session: snapshot.sessionMemoryIds.length,
      total: snapshot.totalMemories
    });
  }

  /**
   * Save state to disk
   */
  private async saveState(state: StateCapture): Promise<string> {
    const vaultPath = this.vaultManager.getVaultPath();
    const statesPath = path.join(vaultPath, this.statesPath);
    
    // Convert dates to ISO strings for JSON
    const serializable = {
      ...state,
      timestamp: state.timestamp.toISOString(),
      metadata: {
        ...state.metadata,
        expiresAt: state.metadata.expiresAt?.toISOString()
      }
    };
    
    const json = JSON.stringify(serializable, null, 2);
    const filename = `${state.id}.json${this.compressionEnabled ? '.gz' : ''}`;
    const filepath = path.join(statesPath, filename);
    
    if (this.compressionEnabled) {
      const compressed = gzipSync(Buffer.from(json));
      await fs.writeFile(filepath, compressed);
    } else {
      await fs.writeFile(filepath, json, 'utf-8');
    }
    
    return filepath;
  }

  /**
   * Load state from disk
   */
  private async loadState(stateId: string): Promise<StateCapture | null> {
    const vaultPath = this.vaultManager.getVaultPath();
    const statesPath = path.join(vaultPath, this.statesPath);
    
    // Find state file
    const files = await fs.readdir(statesPath);
    const stateFile = files.find(f => f.includes(stateId));
    
    if (!stateFile) {
      return null;
    }
    
    return this.loadStateFromFile(path.join(statesPath, stateFile));
  }

  /**
   * Load state from file
   */
  private async loadStateFromFile(filepath: string): Promise<StateCapture | null> {
    try {
      let json: string;
      
      if (filepath.endsWith('.gz')) {
        const compressed = await fs.readFile(filepath);
        json = gunzipSync(compressed).toString('utf-8');
      } else {
        json = await fs.readFile(filepath, 'utf-8');
      }
      
      const parsed = JSON.parse(json);
      
      // Convert ISO strings back to dates
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
        metadata: {
          ...parsed.metadata,
          expiresAt: parsed.metadata.expiresAt ? new Date(parsed.metadata.expiresAt) : undefined
        }
      };
    } catch (error) {
      console.error(`Failed to load state from ${filepath}:`, error);
      return null;
    }
  }

  /**
   * Clean up old states
   */
  private async cleanupOldStates(): Promise<void> {
    try {
      const states = await this.listStates();
      
      // Remove expired states
      const now = Date.now();
      const expiredStates = states.filter(s => 
        s.metadata.expiresAt && new Date(s.metadata.expiresAt).getTime() < now
      );
      
      for (const state of expiredStates) {
        await this.deleteState(state.id);
      }
      
      // Remove oldest states if over limit
      const remainingStates = states.filter(s => 
        !s.metadata.expiresAt || new Date(s.metadata.expiresAt).getTime() >= now
      );
      
      if (remainingStates.length > this.maxStatesPerVault) {
        const toDelete = remainingStates
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .slice(0, remainingStates.length - this.maxStatesPerVault);
          
        for (const state of toDelete) {
          // Don't delete important states
          if (state.metadata.importance < 0.8) {
            await this.deleteState(state.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old states:', error);
    }
  }

  /**
   * Get relevant environment variables
   */
  private getRelevantEnvVars(): Record<string, string> {
    const relevant = [
      'NODE_ENV',
      'OPENAI_API_KEY',
      'CHROMA_HOST',
      'CHROMA_PORT',
      'MEMORY_COLLECTION_NAME',
      'OBSIDIAN_VAULT_PATH'
    ];
    
    const vars: Record<string, string> = {};
    for (const key of relevant) {
      if (process.env[key]) {
        vars[key] = key.includes('KEY') ? '***' : process.env[key]!;
      }
    }
    
    return vars;
  }

  /**
   * Get current git branch
   */
  private async getGitBranch(): Promise<string | undefined> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('git branch --show-current');
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Get git status
   */
  private async getGitStatus(): Promise<string | undefined> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('git status --short');
      return stdout.trim();
    } catch {
      return undefined;
    }
  }
}