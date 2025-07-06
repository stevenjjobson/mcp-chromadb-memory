import { promises as fs } from 'fs';
import * as path from 'path';
import { ObsidianManager } from './obsidian-manager.js';

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
 * This is a placeholder implementation that wraps ObsidianManager for now
 */
export class VaultManager {
  private obsidianManager: ObsidianManager;
  private activeVault: Vault;

  constructor(obsidianManager: ObsidianManager) {
    this.obsidianManager = obsidianManager;
    this.activeVault = {
      name: 'default',
      path: obsidianManager.getVaultPath(),
      type: 'obsidian',
      isActive: true
    };
  }

  async initialize(): Promise<void> {
    // Already initialized through ObsidianManager
  }

  getActiveVault(): Vault {
    return this.activeVault;
  }

  getVaultPath(): string {
    return this.activeVault.path;
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

  // Future methods to implement:
  // async switchVault(vaultName: string): Promise<void>
  // async backupVault(vaultName?: string): Promise<void>
  // async restoreVault(backupPath: string, vaultName: string): Promise<void>
  // async createVault(name: string, path: string, type: 'obsidian' | 'filesystem'): Promise<void>
  // async deleteVault(name: string): Promise<void>
  // async exportVault(vaultName: string, format: 'zip' | 'tar'): Promise<string>
  // async importVault(archivePath: string, name: string): Promise<void>
}