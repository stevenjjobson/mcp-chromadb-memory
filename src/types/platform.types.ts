/**
 * Platform Types for Cognitive State Management
 * Defines core interfaces for vault management, state capture, and tiered memory
 */

export type VaultType = 'project' | 'personal' | 'team';
export type TierName = 'working' | 'session' | 'longTerm';

/**
 * Vault information for multi-project support
 */
export interface VaultInfo {
  id: string;
  name: string;
  path: string;
  type: VaultType;
  created: Date;
  lastAccessed: Date;
  lastModified: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
  backup?: {
    enabled: boolean;
    lastBackup?: Date;
    backupPath?: string;
  };
}

/**
 * Working context for state capture
 */
export interface WorkingContext {
  activeFiles: string[];
  openTabs: string[];
  currentFile?: string;
  cursorPosition?: {
    file: string;
    line: number;
    column: number;
  };
  recentCommands: string[];
  environmentVariables: Record<string, string>;
  gitBranch?: string;
  gitStatus?: string;
}

/**
 * Metadata for state captures
 */
export interface StateMetadata {
  name: string;
  description?: string;
  tags: string[];
  importance: number;
  autoCapture: boolean;
  expiresAt?: Date;
}

/**
 * State capture for context preservation
 */
export interface StateCapture {
  id: string;
  vaultId: string;
  timestamp: Date;
  context: WorkingContext;
  metadata: StateMetadata;
  memorySnapshot?: {
    workingMemoryIds: string[];
    sessionMemoryIds: string[];
    totalMemories: number;
  };
  compressed: boolean;
  size: number; // in bytes
}

/**
 * Configuration for memory tiers
 */
export interface TierConfig {
  name: TierName;
  retention: number; // hours
  maxSize: number; // number of memories
  importanceThreshold: number; // 0-1
  accessThreshold?: number; // minimum access count
  compressionEnabled: boolean;
  indexingStrategy: 'full' | 'partial' | 'lazy';
}

/**
 * Vault registry for managing multiple vaults
 */
export interface VaultRegistry {
  version: string;
  activeVaultId: string;
  vaults: Record<string, VaultInfo>;
  defaultSettings: {
    autoSwitch: boolean;
    backupOnSwitch: boolean;
    compressBackups: boolean;
  };
}

/**
 * State comparison for diffs
 */
export interface StateDiff {
  stateId1: string;
  stateId2: string;
  timestamp: Date;
  differences: {
    files: {
      added: string[];
      removed: string[];
      modified: string[];
    };
    context: {
      field: string;
      before: any;
      after: any;
    }[];
    memories: {
      added: number;
      removed: number;
      modified: number;
    };
  };
}

/**
 * Migration report for tier management
 */
export interface MigrationReport {
  timestamp: Date;
  duration: number; // milliseconds
  migrations: {
    fromTier: TierName;
    toTier: TierName;
    count: number;
    success: number;
    failed: number;
    errors?: string[];
  }[];
  totalMigrated: number;
  totalFailed: number;
}

/**
 * Consolidation report for memory deduplication
 */
export interface ConsolidationReport {
  timestamp: Date;
  duration: number;
  groups: number;
  consolidated: number;
  saved: number; // bytes saved
  errors?: string[];
}

/**
 * Similarity group for consolidation
 */
export interface SimilarityGroup {
  id: string;
  memories: Array<{
    id: string;
    content: string;
    similarity: number;
  }>;
  averageSimilarity: number;
  suggestedMerge?: {
    content: string;
    metadata: Record<string, any>;
  };
}

/**
 * Service status for monitoring
 */
export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping';
  lastActivity: Date;
  errors?: string[];
  metrics?: {
    cpu: number;
    memory: number;
    operations: number;
  };
}

/**
 * Background service interface
 */
export interface BackgroundService {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): ServiceStatus;
  isRunning(): boolean;
}

/**
 * Pattern detection result
 */
export interface Pattern {
  id: string;
  type: 'code' | 'workflow' | 'decision' | 'error';
  pattern: string;
  frequency: number;
  confidence: number;
  firstSeen: Date;
  lastSeen: Date;
  examples: string[];
  metadata?: Record<string, any>;
}

/**
 * Suggestion based on patterns
 */
export interface Suggestion {
  id: string;
  patternId: string;
  content: string;
  confidence: number;
  context: string;
  reasoning: string;
  accepted?: boolean;
  feedback?: string;
}

/**
 * Vault backup information
 */
export interface VaultBackup {
  id: string;
  vaultId: string;
  timestamp: Date;
  path: string;
  size: number;
  compressed: boolean;
  checksum: string;
  metadata?: {
    memoriesCount: number;
    statesCount: number;
    filesCount: number;
  };
}