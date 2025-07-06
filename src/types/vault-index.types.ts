export interface VaultIndex {
  timestamp: Date;
  health: SystemHealth;
  activeContext: ActiveContext;
  vaultStats: VaultStatistics;
  navigation: NavigationLinks;
}

export interface SystemHealth {
  chromadb: HealthCheckResult;
  memoryCollections: MemoryCollectionsHealth;
  sessionLogger: HealthCheckResult;
  vaultStructure: HealthCheckResult;
  templateCache: TemplateCacheHealth;
  overall: HealthStatus;
}

export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  latency?: number;
  details?: Record<string, any>;
}

export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';

export interface MemoryCollectionsHealth extends HealthCheckResult {
  collections: number;
  totalMemories: number;
  workingMemories: number;
  sessionMemories: number;
  longTermMemories: number;
}

export interface TemplateCacheHealth extends HealthCheckResult {
  usage: number;
  maxSize: number;
  percentUsed: number;
}

export interface ActiveContext {
  currentSession?: SessionInfo;
  recentMemories: MemorySummary;
  activeTasks: TaskSummary[];
  lastSession?: SessionInfo;
}

export interface SessionInfo {
  id: string;
  startTime: Date;
  duration?: string;
  project: string;
  toolsUsed: number;
  filesModified: number;
  achievements?: string[];
}

export interface MemorySummary {
  last24Hours: number;
  lastWeek: number;
  total: number;
  byContext: Record<string, number>;
  recentQueries?: string[];
}

export interface TaskSummary {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  path?: string;
}

export interface VaultStatistics {
  totalFiles: number;
  filesByType: Record<string, number>;
  documentationCoverage: CoverageStats;
  folderSizes: FolderStats[];
  recentlyModified: FileInfo[];
}

export interface CoverageStats {
  documented: number;
  total: number;
  percentage: number;
  byCategory: Record<string, { documented: number; total: number }>;
}

export interface FolderStats {
  path: string;
  name: string;
  fileCount: number;
  size?: number;
  lastModified?: Date;
}

export interface FileInfo {
  path: string;
  name: string;
  modified: Date;
  size: number;
  type: string;
}

export interface NavigationLinks {
  activeProject: string;
  todaysTasks: string;
  recentDecisions: string;
  sessionHistory: string;
  templates: string;
  documentation: string;
}

// Memory Health Types
export interface MemoryHealth {
  fragmentation: FragmentationAnalysis;
  duplicates: DuplicateAnalysis;
  orphaned: OrphanedAnalysis;
  performance: PerformanceMetrics;
  recommendations: string[];
}

export interface FragmentationAnalysis {
  percentage: number;
  status: HealthStatus;
  details: {
    totalMemories: number;
    fragmentedMemories: number;
    averageGap: number;
  };
}

export interface DuplicateAnalysis {
  count: number;
  groups: DuplicateGroup[];
}

export interface DuplicateGroup {
  similarity: number;
  memories: Array<{
    id: string;
    content: string;
    timestamp: Date;
  }>;
}

export interface OrphanedAnalysis {
  count: number;
  memories: Array<{
    id: string;
    reason: string;
    lastAccessed?: Date;
  }>;
}

export interface PerformanceMetrics {
  avgQueryTime: number;
  slowQueries: number;
  queryCount: number;
  indexingSpeed: number;
}

// Startup Summary Types
export interface StartupSummary {
  timestamp: Date;
  version: string;
  health: SystemHealthSummary;
  context: StartupContext;
  recommendations: string[];
  quickActions?: QuickAction[];
}

export interface SystemHealthSummary {
  overall: HealthStatus;
  components: Record<string, string>;
  warnings: string[];
  errors: string[];
}

export interface StartupContext {
  totalMemories: number;
  recentMemories: number;
  workingMemoryLoad: number;
  activeTasks: TaskSummary[];
  lastSession?: SessionInfo;
  projectSummary?: string;
}

export interface QuickAction {
  label: string;
  command: string;
  description?: string;
}

// File Watcher Types
export interface WatchEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  timestamp: Date;
}

export interface IndexUpdate {
  section: 'health' | 'context' | 'stats' | 'navigation' | 'all';
  trigger: WatchEvent | 'manual' | 'scheduled';
  timestamp: Date;
}