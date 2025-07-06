import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ObsidianManager } from './obsidian-manager.js';
import {
  VaultInfo,
  VaultType,
  VaultRegistry,
  VaultBackup
} from './types/platform.types.js';

const execAsync = promisify(exec);

// Generate unique ID similar to other parts of the codebase
const generateId = (prefix: string = 'vault'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Keep backward compatibility
export interface Vault {
  name: string;
  path: string;
  type: 'obsidian' | 'filesystem' | 'cloud';
  isActive: boolean;
}

export interface VaultConfig {
  vaults: Vault[];
  activeVault?: string;
  backupEnabled?: boolean;
  backupPath?: string;
}

/**
 * VaultManager handles multiple document vaults with hot-swapping capabilities
 * Enhanced with full multi-vault support, backup/restore, and registry management
 */
export class VaultManager {
  private obsidianManager: ObsidianManager;
  private activeVault: Vault;
  private registry: VaultRegistry;
  private registryPath: string;
  private vaultInfoMap: Map<string, VaultInfo> = new Map();

  constructor(
    obsidianManager: ObsidianManager,
    registryPath: string = './vault-registry.json'
  ) {
    this.obsidianManager = obsidianManager;
    this.registryPath = registryPath;
    this.activeVault = {
      name: 'default',
      path: obsidianManager.getVaultPath(),
      type: 'obsidian',
      isActive: true
    };
    
    // Initialize registry
    this.registry = {
      version: '1.0.0',
      activeVaultId: '',
      vaults: {},
      defaultSettings: {
        autoSwitch: true,
        backupOnSwitch: true,
        compressBackups: true
      }
    };
  }

  async initialize(): Promise<void> {
    try {
      // Load registry from disk
      await this.loadRegistry();
      
      // Create default vault if none exist
      if (Object.keys(this.registry.vaults).length === 0) {
        await this.createDefaultVault();
      }
      
      // Set active vault
      if (this.registry.activeVaultId) {
        const vaultInfo = this.registry.vaults[this.registry.activeVaultId];
        if (vaultInfo) {
          this.activeVault = this.vaultInfoToVault(vaultInfo);
          this.vaultInfoMap.set(vaultInfo.id, vaultInfo);
        }
      }
      
      console.error(`VaultManager initialized with ${Object.keys(this.registry.vaults).length} vaults`);
    } catch (error) {
      console.error('VaultManager initialization error:', error);
      // Continue with default vault on error
    }
  }

  getActiveVault(): Vault {
    return this.activeVault;
  }

  getVaultPath(): string {
    return this.activeVault.path;
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
      // Registry doesn't exist yet, use defaults
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
  
  /**
   * Create default vault from current Obsidian vault
   */
  private async createDefaultVault(): Promise<void> {
    const vaultId = generateId('vault');
    const vaultInfo: VaultInfo = {
      id: vaultId,
      name: 'Default Vault',
      path: this.obsidianManager.getVaultPath(),
      type: 'personal',
      created: new Date(),
      lastAccessed: new Date(),
      lastModified: new Date(),
      isActive: true,
      metadata: { source: 'obsidian' }
    };
    
    this.registry.vaults[vaultId] = vaultInfo;
    this.registry.activeVaultId = vaultId;
    await this.saveRegistry();
  }
  
  /**
   * Convert VaultInfo to legacy Vault interface
   */
  private vaultInfoToVault(info: VaultInfo): Vault {
    return {
      name: info.name,
      path: info.path,
      type: info.metadata?.source === 'obsidian' ? 'obsidian' : 'filesystem',
      isActive: info.isActive
    };
  }

  async saveDocument(filename: string, content: string): Promise<void> {
    // For now, delegate to ObsidianManager
    const notePath = filename.endsWith('.md') ? filename : `${filename}.md`;
    await this.obsidianManager.writeNote(notePath, content);
  }

  async readDocument(filename: string): Promise<string | null> {
    // For now, delegate to ObsidianManager
    const note = await this.obsidianManager.readNote(filename);
    return note ? note.content : null;
  }

  async listDocuments(folderPath?: string): Promise<string[]> {
    // For now, delegate to ObsidianManager
    const notes = await this.obsidianManager.listNotes(folderPath || '');
    return notes.map((n: any) => n.path);
  }

  /**
   * Register a new vault
   */
  async registerVault(
    name: string,
    vaultPath: string,
    type: VaultType,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      // Validate path
      const resolvedPath = path.resolve(vaultPath);
      
      // Check if path already registered
      for (const vault of Object.values(this.registry.vaults)) {
        if (path.resolve(vault.path) === resolvedPath) {
          throw new Error(`Vault already registered at path: ${resolvedPath}`);
        }
      }
      
      // Create directory if it doesn't exist
      await fs.mkdir(resolvedPath, { recursive: true });
      
      // Generate vault ID
      const vaultId = generateId('vault');
      
      // Create vault info
      const vaultInfo: VaultInfo = {
        id: vaultId,
        name,
        path: vaultPath,
        type,
        created: new Date(),
        lastAccessed: new Date(),
        lastModified: new Date(),
        isActive: false,
        metadata: { ...metadata, source: type === 'personal' ? 'obsidian' : 'filesystem' },
        backup: {
          enabled: true
        }
      };
      
      // Add to registry
      this.registry.vaults[vaultId] = vaultInfo;
      this.vaultInfoMap.set(vaultId, vaultInfo);
      
      // Save registry
      await this.saveRegistry();
      
      console.error(`Registered vault "${name}" at ${vaultPath}`);
      return vaultId;
    } catch (error) {
      console.error('Failed to register vault:', error);
      throw error;
    }
  }

  /**
   * Switch to a different vault
   */
  async switchVault(vaultId: string): Promise<void> {
    try {
      const targetVaultInfo = this.registry.vaults[vaultId];
      if (!targetVaultInfo) {
        throw new Error(`Vault not found: ${vaultId}`);
      }
      
      // Backup current vault if enabled
      const currentVaultInfo = this.vaultInfoMap.get(this.registry.activeVaultId);
      if (currentVaultInfo && this.registry.defaultSettings.backupOnSwitch) {
        await this.backupVault(currentVaultInfo.id);
      }
      
      // Update active states
      if (currentVaultInfo) {
        currentVaultInfo.isActive = false;
      }
      
      targetVaultInfo.isActive = true;
      targetVaultInfo.lastAccessed = new Date();
      this.activeVault = this.vaultInfoToVault(targetVaultInfo);
      this.registry.activeVaultId = vaultId;
      
      // Update Obsidian manager path
      this.obsidianManager.updateVaultPath(targetVaultInfo.path);
      
      // Save registry
      await this.saveRegistry();
      
      console.error(`Switched to vault "${targetVaultInfo.name}"`);
    } catch (error) {
      console.error('Failed to switch vault:', error);
      throw error;
    }
  }

  /**
   * List all registered vaults
   */
  async listVaults(): Promise<VaultInfo[]> {
    return Object.values(this.registry.vaults);
  }

  /**
   * Backup a vault
   */
  async backupVault(vaultId?: string): Promise<string> {
    try {
      const vault = vaultId 
        ? this.registry.vaults[vaultId]
        : this.registry.vaults[this.registry.activeVaultId];
        
      if (!vault) {
        throw new Error('No vault to backup');
      }
      
      // Create backup directory
      const backupDir = path.join(path.dirname(vault.path), 'backups');
      await fs.mkdir(backupDir, { recursive: true });
      
      // Generate backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `${vault.name.replace(/\s+/g, '-')}_${timestamp}`;
      const backupPath = path.join(backupDir, backupName);
      
      // Create backup based on compression setting
      if (this.registry.defaultSettings.compressBackups) {
        // Use tar for compression
        const tarPath = `${backupPath}.tar.gz`;
        await execAsync(
          `tar -czf "${tarPath}" -C "${path.dirname(vault.path)}" "${path.basename(vault.path)}"`
        );
        
        // Update vault backup info
        vault.backup = {
          enabled: true,
          lastBackup: new Date(),
          backupPath: tarPath
        };
      } else {
        // Simple copy
        await this.copyDirectory(vault.path, backupPath);
        
        vault.backup = {
          enabled: true,
          lastBackup: new Date(),
          backupPath
        };
      }
      
      // Save registry
      await this.saveRegistry();
      
      console.error(`Backed up vault "${vault.name}" to ${vault.backup.backupPath}`);
      return vault.backup.backupPath!;
    } catch (error) {
      console.error('Failed to backup vault:', error);
      throw error;
    }
  }

  /**
   * Restore a vault from backup
   */
  async restoreVault(backupPath: string, targetVaultId?: string): Promise<void> {
    try {
      const vault = targetVaultId
        ? this.registry.vaults[targetVaultId]
        : this.registry.vaults[this.registry.activeVaultId];
        
      if (!vault) {
        throw new Error('No vault to restore to');
      }
      
      // Check if backup exists
      await fs.access(backupPath);
      
      // Backup current state before restore
      const tempBackup = await this.backupVault(vault.id);
      
      try {
        // Clear current vault
        await fs.rm(vault.path, { recursive: true, force: true });
        await fs.mkdir(vault.path, { recursive: true });
        
        // Restore based on backup type
        if (backupPath.endsWith('.tar.gz')) {
          await execAsync(
            `tar -xzf "${backupPath}" -C "${vault.path}" --strip-components=1`
          );
        } else {
          await this.copyDirectory(backupPath, vault.path);
        }
        
        vault.lastModified = new Date();
        await this.saveRegistry();
        
        console.error(`Restored vault "${vault.name}" from ${backupPath}`);
      } catch (error) {
        // Restore failed, rollback
        console.error('Restore failed, rolling back...');
        await fs.rm(vault.path, { recursive: true, force: true });
        
        if (tempBackup.endsWith('.tar.gz')) {
          await execAsync(
            `tar -xzf "${tempBackup}" -C "${vault.path}" --strip-components=1`
          );
        } else {
          await this.copyDirectory(tempBackup, vault.path);
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Failed to restore vault:', error);
      throw error;
    }
  }

  /**
   * Delete a vault
   */
  async deleteVault(vaultId: string, deleteFiles: boolean = false): Promise<void> {
    const vault = this.registry.vaults[vaultId];
    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }
    
    if (vault.isActive) {
      throw new Error('Cannot delete active vault');
    }
    
    // Delete files if requested
    if (deleteFiles) {
      await fs.rm(vault.path, { recursive: true, force: true });
    }
    
    // Remove from registry
    delete this.registry.vaults[vaultId];
    this.vaultInfoMap.delete(vaultId);
    await this.saveRegistry();
    
    console.error(`Deleted vault "${vault.name}"`);
  }

  /**
   * Get vault statistics
   */
  async getVaultStats(vaultId?: string): Promise<any> {
    const vault = vaultId
      ? this.registry.vaults[vaultId]
      : this.registry.vaults[this.registry.activeVaultId];
      
    if (!vault) {
      throw new Error('No vault specified');
    }
    
    try {
      // Count files and calculate size
      let fileCount = 0;
      let totalSize = 0;
      
      const countFiles = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await countFiles(fullPath);
          } else if (entry.isFile()) {
            fileCount++;
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          }
        }
      };
      
      await countFiles(vault.path);
      
      return {
        id: vault.id,
        name: vault.name,
        path: vault.path,
        type: vault.type,
        fileCount,
        totalSize,
        created: vault.created,
        lastAccessed: vault.lastAccessed,
        lastModified: vault.lastModified,
        hasBackup: !!vault.backup?.lastBackup,
        lastBackup: vault.backup?.lastBackup
      };
    } catch (error) {
      console.error('Failed to get vault stats:', error);
      throw error;
    }
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}