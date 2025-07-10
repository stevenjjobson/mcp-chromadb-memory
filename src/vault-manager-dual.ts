import { promises as fs } from 'fs';
import * as path from 'path';
import { ObsidianManager } from './obsidian-manager.js';
import {
  VaultInfo,
  VaultType,
  VaultRegistry,
  VaultBackup
} from './types/platform.types.js';

// Generate unique ID similar to other parts of the codebase
const generateId = (prefix: string = 'vault'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export interface DualVaultConfig {
  coreVaultPath?: string;
  projectVaultPath: string;
  vaultMode: 'single' | 'dual' | 'multi';
  defaultContext: 'core' | 'project';
  enableCrossVaultSearch: boolean;
  searchStrategy: 'weighted' | 'sequential' | 'parallel';
  weights?: {
    core: number;
    project: number;
  };
}

export interface VaultContext {
  coreVault?: VaultInfo;
  projectVault: VaultInfo;
  activeContext: 'core' | 'project' | 'both';
  searchStrategy: SearchStrategy;
}

export interface SearchStrategy {
  defaultVaults: ('core' | 'project')[];
  weights: { core: number; project: number };
  fallbackBehavior: 'none' | 'expand' | 'suggest';
}

export interface MemoryTarget {
  vault: 'core' | 'project';
  confidence: number;
  reasoning: string;
  alternativeSuggestion?: MemoryTarget;
}

/**
 * Enhanced VaultManager with dual vault support for core knowledge + project contexts
 */
export class DualVaultManager {
  private coreObsidianManager?: ObsidianManager;
  private projectObsidianManager: ObsidianManager;
  private context: VaultContext;
  private registry: VaultRegistry;
  private registryPath: string;
  private config: DualVaultConfig;

  constructor(
    projectObsidianManager: ObsidianManager,
    config: DualVaultConfig,
    coreObsidianManager?: ObsidianManager,
    registryPath: string = './vault-registry.json'
  ) {
    this.projectObsidianManager = projectObsidianManager;
    this.coreObsidianManager = coreObsidianManager;
    this.config = config;
    this.registryPath = registryPath;
    
    // Initialize registry
    this.registry = {
      version: '2.0.0',
      vaults: {},
      activeVaultId: '',
      coreVaultId: ''
    };

    // Initialize context
    this.context = {
      projectVault: this.createVaultInfo('project', config.projectVaultPath),
      coreVault: config.coreVaultPath ? this.createVaultInfo('core', config.coreVaultPath) : undefined,
      activeContext: config.defaultContext,
      searchStrategy: {
        defaultVaults: config.vaultMode === 'dual' ? ['project', 'core'] : ['project'],
        weights: config.weights || { core: 0.3, project: 0.7 },
        fallbackBehavior: 'expand'
      }
    };
  }

  /**
   * Initialize the dual vault system
   */
  async initialize(): Promise<void> {
    await this.loadRegistry();
    
    // Set up project vault
    if (!this.registry.vaults[this.context.projectVault.id]) {
      this.registry.vaults[this.context.projectVault.id] = this.context.projectVault;
    }
    
    // Set up core vault if in dual mode
    if (this.config.vaultMode === 'dual' && this.context.coreVault) {
      if (!this.registry.vaults[this.context.coreVault.id]) {
        this.registry.vaults[this.context.coreVault.id] = this.context.coreVault;
        this.registry.coreVaultId = this.context.coreVault.id;
      }
    }
    
    this.registry.activeVaultId = this.context.projectVault.id;
    await this.saveRegistry();
  }

  /**
   * Create vault info object
   */
  private createVaultInfo(type: 'core' | 'project', vaultPath: string): VaultInfo {
    const vaultId = generateId(type);
    return {
      id: vaultId,
      name: type === 'core' ? 'Core Knowledge Vault' : 'Project Vault',
      path: vaultPath,
      type: type === 'core' ? 'personal' : 'project',
      created: new Date(),
      lastAccessed: new Date(),
      lastModified: new Date(),
      isActive: true,
      metadata: {
        vaultType: type,
        source: 'obsidian'
      }
    };
  }

  /**
   * Get the appropriate Obsidian manager for a vault context
   */
  private getManager(vault: 'core' | 'project' | 'active'): ObsidianManager {
    if (vault === 'core' && this.coreObsidianManager) {
      return this.coreObsidianManager;
    }
    return this.projectObsidianManager;
  }

  /**
   * Categorize content to determine target vault
   */
  async categorizeContent(content: string, metadata?: Record<string, any>): Promise<MemoryTarget> {
    // Keywords that suggest core knowledge
    const corePatterns = [
      /always\s+use/i,
      /my\s+preferred/i,
      /i\s+prefer/i,
      /best\s+practice/i,
      /general\s+rule/i,
      /across\s+projects/i,
      /learned\s+that/i,
      /personal\s+preference/i
    ];

    // Keywords that suggest project-specific
    const projectPatterns = [
      /this\s+project/i,
      /in\s+this\s+codebase/i,
      /decided\s+to/i,
      /we\s+are\s+using/i,
      /configured\s+with/i,
      /specific\s+to/i,
      /local\s+setup/i
    ];

    let coreScore = 0;
    let projectScore = 0;

    // Check content against patterns
    for (const pattern of corePatterns) {
      if (pattern.test(content)) coreScore++;
    }
    for (const pattern of projectPatterns) {
      if (pattern.test(content)) projectScore++;
    }

    // Check metadata hints
    if (metadata?.scope === 'personal') coreScore += 2;
    if (metadata?.scope === 'project') projectScore += 2;
    if (metadata?.vault === 'core') coreScore += 3;
    if (metadata?.vault === 'project') projectScore += 3;

    // Determine target
    const total = coreScore + projectScore;
    if (total === 0) {
      // Default to project for uncertain content
      return {
        vault: 'project',
        confidence: 0.5,
        reasoning: 'No clear indicators, defaulting to project vault'
      };
    }

    const coreConfidence = coreScore / total;
    const projectConfidence = projectScore / total;

    if (coreConfidence > projectConfidence) {
      return {
        vault: 'core',
        confidence: coreConfidence,
        reasoning: `Content appears to be general knowledge or personal preference (${Math.round(coreConfidence * 100)}% confident)`,
        alternativeSuggestion: projectConfidence > 0.3 ? {
          vault: 'project',
          confidence: projectConfidence,
          reasoning: 'Could also be project-specific'
        } : undefined
      };
    } else {
      return {
        vault: 'project',
        confidence: projectConfidence,
        reasoning: `Content appears to be project-specific (${Math.round(projectConfidence * 100)}% confident)`,
        alternativeSuggestion: coreConfidence > 0.3 ? {
          vault: 'core',
          confidence: coreConfidence,
          reasoning: 'Could also be general knowledge'
        } : undefined
      };
    }
  }

  /**
   * Save document to appropriate vault
   */
  async saveDocument(
    filename: string, 
    content: string, 
    options?: { 
      vault?: 'core' | 'project' | 'auto';
      metadata?: Record<string, any>;
    }
  ): Promise<{ vault: 'core' | 'project'; path: string }> {
    let targetVault: 'core' | 'project' = 'project';

    // Determine target vault
    if (options?.vault === 'auto') {
      const target = await this.categorizeContent(content, options.metadata);
      targetVault = target.vault;
      
      // If low confidence, might want to ask user
      if (target.confidence < this.config.weights?.project || 0.7) {
        console.log(`Auto-categorization suggestion: ${target.reasoning}`);
        if (target.alternativeSuggestion) {
          console.log(`Alternative: ${target.alternativeSuggestion.reasoning}`);
        }
      }
    } else if (options?.vault) {
      targetVault = options.vault;
    }

    // Get appropriate manager
    const manager = this.getManager(targetVault);
    const notePath = filename.endsWith('.md') ? filename : `${filename}.md`;
    
    // Add vault metadata to content
    const enhancedContent = `---
vault: ${targetVault}
created: ${new Date().toISOString()}
${options?.metadata ? Object.entries(options.metadata).map(([k, v]) => `${k}: ${v}`).join('\n') : ''}
---

${content}`;

    await manager.writeNote(notePath, enhancedContent);
    
    return { vault: targetVault, path: notePath };
  }

  /**
   * Read document from specified vault
   */
  async readDocument(
    filename: string, 
    vault: 'core' | 'project' | 'active' = 'active'
  ): Promise<string | null> {
    const manager = this.getManager(vault);
    const note = await manager.readNote(filename);
    return note ? note.content : null;
  }

  /**
   * Search across vaults based on search strategy
   */
  async searchDocuments(
    query: string,
    options?: {
      vaults?: ('core' | 'project')[];
      strategy?: 'weighted' | 'sequential' | 'isolated';
      limit?: number;
    }
  ): Promise<Array<{ vault: 'core' | 'project'; path: string; content: string; score: number }>> {
    const vaultsToSearch = options?.vaults || this.context.searchStrategy.defaultVaults;
    const strategy = options?.strategy || 'weighted';
    const limit = options?.limit || 10;
    
    const results: Array<{ vault: 'core' | 'project'; path: string; content: string; score: number }> = [];

    // Search each vault
    for (const vault of vaultsToSearch) {
      if (vault === 'core' && !this.coreObsidianManager) continue;
      
      const manager = this.getManager(vault);
      const vaultResults = await manager.searchNotes(query, { limit: limit * 2 });
      
      // Add vault context and apply weights if using weighted strategy
      for (const result of vaultResults) {
        const weight = strategy === 'weighted' 
          ? this.context.searchStrategy.weights[vault]
          : 1.0;
          
        results.push({
          vault,
          path: result.note.path,
          content: result.note.content,
          score: result.score * weight
        });
      }
    }

    // Sort by score and limit results
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * List documents from specified vault(s)
   */
  async listDocuments(
    folderPath?: string,
    vault: 'core' | 'project' | 'both' = 'active'
  ): Promise<Array<{ vault: 'core' | 'project'; path: string }>> {
    const results: Array<{ vault: 'core' | 'project'; path: string }> = [];

    if (vault === 'both' || vault === 'project') {
      const projectNotes = await this.projectObsidianManager.listNotes(folderPath || '');
      results.push(...projectNotes.map((n: any) => ({ vault: 'project' as const, path: n.path })));
    }

    if ((vault === 'both' || vault === 'core') && this.coreObsidianManager) {
      const coreNotes = await this.coreObsidianManager.listNotes(folderPath || '');
      results.push(...coreNotes.map((n: any) => ({ vault: 'core' as const, path: n.path })));
    }

    return results;
  }

  /**
   * Switch active project vault
   */
  async switchProjectVault(
    newProjectPath: string,
    projectName?: string
  ): Promise<void> {
    // Create new project vault info
    const newProjectVault = this.createVaultInfo('project', newProjectPath);
    if (projectName) {
      newProjectVault.name = projectName;
    }

    // Update registry
    this.registry.vaults[newProjectVault.id] = newProjectVault;
    this.registry.activeVaultId = newProjectVault.id;
    
    // Update context
    this.context.projectVault = newProjectVault;
    
    // Create new ObsidianManager for the project
    const { ChromaClient } = await import('chromadb');
    const chromaClient = new ChromaClient({ path: process.env.CHROMA_HOST });
    this.projectObsidianManager = new ObsidianManager(newProjectPath, chromaClient);
    
    await this.saveRegistry();
  }

  /**
   * Get current vault context
   */
  getVaultContext(): VaultContext {
    return this.context;
  }

  /**
   * Get vault statistics
   */
  async getVaultStats(): Promise<{
    core?: { totalNotes: number; size: number };
    project: { totalNotes: number; size: number };
  }> {
    const stats: any = {};

    // Project stats
    const projectNotes = await this.projectObsidianManager.listNotes('');
    stats.project = {
      totalNotes: projectNotes.length,
      size: 0 // Would need to calculate actual size
    };

    // Core stats if available
    if (this.coreObsidianManager) {
      const coreNotes = await this.coreObsidianManager.listNotes('');
      stats.core = {
        totalNotes: coreNotes.length,
        size: 0 // Would need to calculate actual size
      };
    }

    return stats;
  }

  /**
   * Promote memory from project to core vault
   */
  async promoteToCore(
    sourcePath: string,
    options?: {
      reason?: string;
      includeMetadata?: boolean;
    }
  ): Promise<{ newPath: string }> {
    if (!this.coreObsidianManager) {
      throw new Error('Core vault not configured');
    }

    // Read from project vault
    const content = await this.readDocument(sourcePath, 'project');
    if (!content) {
      throw new Error('Source document not found');
    }

    // Enhance with promotion metadata
    const promotionDate = new Date().toISOString();
    const enhancedContent = `---
promoted_from: project
promoted_date: ${promotionDate}
promotion_reason: ${options?.reason || 'Manual promotion'}
original_path: ${sourcePath}
---

${content}`;

    // Save to core vault
    const corePath = `promoted/${path.basename(sourcePath)}`;
    await this.coreObsidianManager.writeNote(corePath, enhancedContent);

    return { newPath: corePath };
  }

  /**
   * Load vault registry from disk
   */
  private async loadRegistry(): Promise<void> {
    try {
      const data = await fs.readFile(this.registryPath, 'utf-8');
      const loaded = JSON.parse(data);
      
      // Convert date strings back to Date objects
      for (const vaultId in loaded.vaults) {
        const vault = loaded.vaults[vaultId];
        vault.created = new Date(vault.created);
        vault.lastAccessed = new Date(vault.lastAccessed);
        vault.lastModified = new Date(vault.lastModified);
        if (vault.backup?.lastBackup) {
          vault.backup.lastBackup = new Date(vault.backup.lastBackup);
        }
      }
      
      this.registry = loaded;
    } catch (error) {
      console.error('No vault registry found, creating new one');
    }
  }

  /**
   * Save vault registry to disk
   */
  private async saveRegistry(): Promise<void> {
    try {
      await fs.writeFile(
        this.registryPath,
        JSON.stringify(this.registry, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save vault registry:', error);
      throw error;
    }
  }
}