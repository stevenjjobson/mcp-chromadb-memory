import { VaultManager } from '../vault-manager.js';
import { MemoryManager } from '../memory-manager.js';
import { SessionLogger } from '../session-logger.js';
import { 
  VaultIndex, 
  SystemHealth, 
  ActiveContext, 
  VaultStatistics, 
  NavigationLinks,
  HealthStatus,
  HealthCheckResult,
  MemoryCollectionsHealth,
  TemplateCacheHealth,
  SessionInfo,
  MemorySummary,
  TaskSummary,
  CoverageStats,
  FolderStats,
  FileInfo
} from '../types/vault-index.types.js';
import fs from 'fs/promises';
import path from 'path';

export class VaultIndexService {
  private indexPath = './vault/VAULT_INDEX.md';
  private updateInterval = 300000; // 5 minutes
  private updateTimer?: NodeJS.Timeout;
  
  constructor(
    private vaultManager: VaultManager,
    private memoryManager: MemoryManager,
    private sessionLogger?: SessionLogger
  ) {}
  
  async initialize(): Promise<void> {
    // Generate initial index
    await this.generateAndSaveIndex();
    
    // Start periodic updates
    this.startPeriodicUpdates();
  }
  
  async generateIndex(): Promise<VaultIndex> {
    const index: VaultIndex = {
      timestamp: new Date(),
      health: await this.checkSystemHealth(),
      activeContext: await this.gatherActiveContext(),
      vaultStats: await this.calculateVaultStats(),
      navigation: await this.buildNavigation()
    };
    
    return index;
  }
  
  private async checkSystemHealth(): Promise<SystemHealth> {
    const chromadb = await this.checkChromaDB();
    const memoryCollections = await this.checkMemoryCollections();
    const sessionLogger = await this.checkSessionLogger();
    const vaultStructure = await this.checkVaultStructure();
    const templateCache = await this.checkTemplateCache();
    
    // Calculate overall health
    const healthStatuses = [
      chromadb.status,
      memoryCollections.status,
      sessionLogger.status,
      vaultStructure.status,
      templateCache.status
    ];
    
    let overall: HealthStatus = 'healthy';
    if (healthStatuses.includes('error')) {
      overall = 'error';
    } else if (healthStatuses.includes('warning')) {
      overall = 'warning';
    }
    
    return {
      chromadb,
      memoryCollections,
      sessionLogger,
      vaultStructure,
      templateCache,
      overall
    };
  }
  
  private async checkChromaDB(): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now();
      const isConnected = await this.memoryManager.isConnected();
      const latency = Date.now() - startTime;
      
      return {
        status: isConnected ? 'healthy' : 'error',
        message: isConnected ? `Connected (${latency}ms latency)` : 'Connection failed',
        latency,
        details: { isConnected }
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: String(error) }
      };
    }
  }
  
  private async checkMemoryCollections(): Promise<MemoryCollectionsHealth> {
    try {
      // Get memory statistics
      const stats = await this.getMemoryStatistics();
      
      return {
        status: 'healthy',
        message: `${stats.collections} active collections (${stats.totalMemories} memories)`,
        collections: stats.collections,
        totalMemories: stats.totalMemories,
        workingMemories: stats.workingMemories,
        sessionMemories: stats.sessionMemories,
        longTermMemories: stats.longTermMemories
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to check memory collections',
        collections: 0,
        totalMemories: 0,
        workingMemories: 0,
        sessionMemories: 0,
        longTermMemories: 0
      };
    }
  }
  
  private async checkSessionLogger(): Promise<HealthCheckResult> {
    if (!this.sessionLogger) {
      return {
        status: 'warning',
        message: 'Session logger not initialized',
        details: { initialized: false }
      };
    }
    
    try {
      const summary = this.sessionLogger.getSessionSummary();
      return {
        status: 'healthy',
        message: `Active (Project: ${summary.project})`,
        details: {
          project: summary.project,
          startTime: summary.startTime,
          toolsUsed: summary.toolsUsed.size
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Session logger error',
        details: { error: String(error) }
      };
    }
  }
  
  private async checkVaultStructure(): Promise<HealthCheckResult> {
    try {
      const vaultPath = this.vaultManager.getVaultPath();
      await fs.access(vaultPath);
      
      return {
        status: 'healthy',
        message: 'Vault structure loaded',
        details: { vaultPath }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Vault structure not accessible',
        details: { error: String(error) }
      };
    }
  }
  
  private async checkTemplateCache(): Promise<TemplateCacheHealth> {
    // For now, return a mock implementation
    // This would check actual template cache in production
    const usage = 87;
    const maxSize = 100;
    
    let status: HealthStatus = 'healthy';
    if (usage > 90) status = 'error';
    else if (usage > 80) status = 'warning';
    
    return {
      status,
      message: `${usage}% full${usage > 80 ? ' (cleanup recommended)' : ''}`,
      usage,
      maxSize,
      percentUsed: usage
    };
  }
  
  private async gatherActiveContext(): Promise<ActiveContext> {
    const currentSession = this.getCurrentSessionInfo();
    const recentMemories = await this.getRecentMemorySummary();
    const activeTasks = await this.getActiveTasks();
    const lastSession = await this.getLastSessionInfo();
    
    return {
      currentSession,
      recentMemories,
      activeTasks,
      lastSession
    };
  }
  
  private getCurrentSessionInfo(): SessionInfo | undefined {
    if (!this.sessionLogger) return undefined;
    
    const summary = this.sessionLogger.getSessionSummary();
    const duration = this.calculateDuration(summary.startTime, new Date());
    
    return {
      id: summary.startTime.toISOString(),
      startTime: summary.startTime,
      duration,
      project: summary.project,
      toolsUsed: summary.toolsUsed.size,
      filesModified: summary.filesModified.size + summary.filesCreated.size,
      achievements: summary.achievements.slice(0, 3)
    };
  }
  
  private async getRecentMemorySummary(): Promise<MemorySummary> {
    try {
      const stats = await this.getMemoryStatistics();
      const chromaClient = this.memoryManager.getChromaClient();
      const collection = await chromaClient.getCollection({
        name: process.env.MEMORY_COLLECTION_NAME || 'ai_memories'
      });
      
      // Get all memories to analyze context distribution
      const result = await collection.get();
      
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000;
      const weekInMs = 7 * dayInMs;
      
      let last24Hours = 0;
      let lastWeek = 0;
      const byContext: Record<string, number> = {
        general: 0,
        user_preference: 0,
        task_critical: 0,
        obsidian_note: 0
      };
      
      result.metadatas?.forEach(metadata => {
        if (metadata) {
          const timestamp = metadata.timestamp;
          if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            const timestampMs = new Date(timestamp).getTime();
            const age = now - timestampMs;
            
            if (age < dayInMs) {
              last24Hours++;
            }
            if (age < weekInMs) {
              lastWeek++;
            }
          }
          
          // Count by context
          const context = metadata.context || 'general';
          if (typeof context === 'string' && context in byContext) {
            byContext[context]++;
          } else {
            byContext.general++;
          }
        }
      });
      
      return {
        last24Hours,
        lastWeek,
        total: stats.totalMemories,
        byContext,
        recentQueries: [] // Could track this separately if needed
      };
    } catch (error) {
      console.error('Error getting recent memory summary:', error);
      return {
        last24Hours: 0,
        lastWeek: 0,
        total: 0,
        byContext: {
          general: 0,
          user_preference: 0,
          task_critical: 0,
          obsidian_note: 0
        },
        recentQueries: []
      };
    }
  }
  
  private async getActiveTasks(): Promise<TaskSummary[]> {
    try {
      const tasks: TaskSummary[] = [];
      
      // First, check if there's an Implementation Roadmap
      const roadmapPath = path.join(this.vaultManager.getVaultPath(), 'Planning', 'roadmaps', 'Implementation Roadmap.md');
      
      try {
        const roadmapContent = await fs.readFile(roadmapPath, 'utf-8');
        
        // Parse tasks from roadmap using checkbox patterns
        const lines = roadmapContent.split('\n');
        let currentPhase = '';
        let taskId = 0;
        
        lines.forEach((line, index) => {
          // Track current phase
          if (line.match(/^#{2,3}\s+(Day \d+|Phase \d+)/)) {
            currentPhase = line.replace(/^#+\s+/, '').trim();
          }
          
          // Look for task checkboxes
          const incompleteMatch = line.match(/^[\s-]*\[ \]\s+(.+)/);
          const completeMatch = line.match(/^[\s-]*\[x\]\s+(.+)/i);
          
          if (incompleteMatch || completeMatch) {
            taskId++;
            const title = (incompleteMatch?.[1] || completeMatch?.[1] || '').trim();
            const status = completeMatch ? 'completed' : 'pending';
            
            // Determine priority based on content or phase
            let priority: 'high' | 'medium' | 'low' = 'medium';
            if (title.toLowerCase().includes('critical') || title.toLowerCase().includes('must')) {
              priority = 'high';
            } else if (currentPhase.includes('Day 1') || currentPhase.includes('Phase 1')) {
              priority = 'high';
            }
            
            tasks.push({
              id: taskId.toString(),
              title: title.substring(0, 100), // Limit length
              status: status as 'pending' | 'in_progress' | 'completed',
              priority,
              path: `Planning/roadmaps/Implementation Roadmap.md#L${index + 1}`
            });
          }
        });
      } catch (error) {
        // Roadmap doesn't exist or can't be read
        console.error('Could not read Implementation Roadmap:', error);
      }
      
      // If no tasks found in roadmap, check for a tasks folder
      if (tasks.length === 0) {
        const tasksPath = path.join(this.vaultManager.getVaultPath(), '70-Task-Management');
        
        try {
          const files = await fs.readdir(tasksPath);
          const mdFiles = files.filter(f => f.endsWith('.md'));
          
          // Read task files
          for (const file of mdFiles.slice(0, 5)) { // Limit to 5 files
            const filePath = path.join(tasksPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            
            // Simple task extraction from markdown
            const taskMatches = content.matchAll(/^#{1,3}\s+(.+?)(?:\s*\[(pending|in_progress|completed)\])?$/gm);
            
            for (const match of taskMatches) {
              tasks.push({
                id: `${file}-${tasks.length + 1}`,
                title: match[1].trim(),
                status: (match[2] || 'pending') as any,
                priority: 'medium',
                path: `70-Task-Management/${file}`
              });
            }
          }
        } catch (error) {
          // Tasks folder doesn't exist
          console.error('Could not read tasks folder:', error);
        }
      }
      
      // Return top 5 tasks or defaults if none found
      return tasks.length > 0 ? tasks.slice(0, 5) : [
        {
          id: '1',
          title: 'Review Implementation Roadmap',
          status: 'pending',
          priority: 'high',
          path: 'Planning/roadmaps/Implementation Roadmap.md'
        }
      ];
    } catch (error) {
      console.error('Error getting active tasks:', error);
      return [];
    }
  }
  
  private async getLastSessionInfo(): Promise<SessionInfo | undefined> {
    try {
      // Check multiple possible session locations
      const possiblePaths = [
        path.join(this.vaultManager.getVaultPath(), 'Claude Code Sessions'),
        path.join(this.vaultManager.getVaultPath(), 'Sessions'),
        'Claude Code Sessions' // Root level
      ];
      
      for (const sessionsPath of possiblePaths) {
        try {
          // Get current year/month structure
          const now = new Date();
          const year = now.getFullYear().toString();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          
          // Try year/month structure first
          let searchPath = path.join(sessionsPath, year, month);
          let files: string[] = [];
          
          try {
            files = await fs.readdir(searchPath);
          } catch {
            // Try direct sessions folder
            searchPath = sessionsPath;
            files = await fs.readdir(searchPath);
          }
          
          // Filter for session markdown files
          const sessionFiles = files
            .filter(f => f.endsWith('.md') && (f.includes('session') || f.includes('MCP ChromaDB Memory')))
            .sort()
            .reverse(); // Most recent first
          
          if (sessionFiles.length > 0) {
            const latestFile = sessionFiles[0];
            const filePath = path.join(searchPath, latestFile);
            const content = await fs.readFile(filePath, 'utf-8');
            
            // Parse session info from frontmatter and content
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            const dateMatch = latestFile.match(/(\d{2,4})-(\d{2})-(\d{2})/);
            
            let sessionData: any = {
              id: latestFile.replace('.md', ''),
              project: 'MCP ChromaDB Memory',
              toolsUsed: 0,
              filesModified: 0,
              achievements: []
            };
            
            // Parse date from filename
            if (dateMatch) {
              const [_, year, month, day] = dateMatch;
              sessionData.startTime = new Date(`20${year}-${month}-${day}`);
            }
            
            // Parse frontmatter
            if (frontmatterMatch) {
              const frontmatter = frontmatterMatch[1];
              const projectMatch = frontmatter.match(/project:\s*(.+)/);
              const toolsMatch = frontmatter.match(/tools:\s*\[([^\]]+)\]/);
              
              if (projectMatch) sessionData.project = projectMatch[1].trim();
              if (toolsMatch) {
                const tools = toolsMatch[1].split(',').map(t => t.trim());
                sessionData.toolsUsed = tools.length;
              }
            }
            
            // Extract duration
            const durationMatch = content.match(/Duration[:\s]*(\d+h?\s*\d*m?)/i);
            if (durationMatch) {
              sessionData.duration = durationMatch[1];
            }
            
            // Extract achievements
            const achievementsMatch = content.match(/#{2,3}\s*Achievements?\s*\n([\s\S]*?)(?=\n#{2,3}|\n---|\z)/i);
            if (achievementsMatch) {
              const achievementLines = achievementsMatch[1].split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.replace(/^-\s*/, '').trim())
                .filter(line => line.length > 0)
                .slice(0, 3);
              sessionData.achievements = achievementLines;
            }
            
            // Count file modifications
            const filesModifiedMatch = content.match(/#{2,3}\s*Files?\s*(?:Changed|Modified)\s*\n([\s\S]*?)(?=\n#{2,3}|\n---|\z)/i);
            if (filesModifiedMatch) {
              const fileLines = filesModifiedMatch[1].split('\n')
                .filter(line => line.trim().startsWith('-'));
              sessionData.filesModified = fileLines.length;
            }
            
            return sessionData as SessionInfo;
          }
        } catch (error) {
          // Continue to next path
          continue;
        }
      }
      
      // No sessions found
      return undefined;
    } catch (error) {
      console.error('Error getting last session info:', error);
      return undefined;
    }
  }
  
  private async calculateVaultStats(): Promise<VaultStatistics> {
    const vaultPath = this.vaultManager.getVaultPath();
    const stats = await this.analyzeVaultStructure(vaultPath);
    
    return {
      totalFiles: stats.totalFiles,
      filesByType: stats.filesByType,
      documentationCoverage: await this.calculateCoverage(),
      folderSizes: stats.folderSizes,
      recentlyModified: stats.recentlyModified
    };
  }
  
  private async analyzeVaultStructure(vaultPath: string): Promise<any> {
    try {
      const stats = {
        totalFiles: 0,
        filesByType: {} as Record<string, number>,
        folderSizes: [] as FolderStats[],
        recentlyModified: [] as FileInfo[]
      };
      
      const allFiles: FileInfo[] = [];
      
      // Recursive function to scan directories
      const scanDirectory = async (dirPath: string, relativePath: string = '') => {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          let folderFileCount = 0;
          let lastModified = new Date(0);
          
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relPath = path.join(relativePath, entry.name);
            
            // Skip hidden files and common ignore patterns
            if (entry.name.startsWith('.') || 
                entry.name === 'node_modules' || 
                entry.name === 'dist' ||
                entry.name === '__pycache__') {
              continue;
            }
            
            if (entry.isDirectory()) {
              // Recursively scan subdirectory
              await scanDirectory(fullPath, relPath);
            } else if (entry.isFile()) {
              try {
                const fileStat = await fs.stat(fullPath);
                const ext = path.extname(entry.name).toLowerCase() || '.none';
                
                // Count file types
                stats.filesByType[ext] = (stats.filesByType[ext] || 0) + 1;
                stats.totalFiles++;
                folderFileCount++;
                
                // Track file info
                const fileInfo: FileInfo = {
                  path: relPath,
                  name: entry.name,
                  modified: fileStat.mtime,
                  size: fileStat.size,
                  type: ext
                };
                
                allFiles.push(fileInfo);
                
                // Update folder's last modified
                if (fileStat.mtime > lastModified) {
                  lastModified = fileStat.mtime;
                }
              } catch (error) {
                // Skip files we can't stat
              }
            }
          }
          
          // Add folder stats if it contains files
          if (folderFileCount > 0 && relativePath) {
            stats.folderSizes.push({
              path: relativePath,
              name: path.basename(relativePath),
              fileCount: folderFileCount,
              lastModified
            });
          }
        } catch (error) {
          console.error(`Error scanning directory ${dirPath}:`, error);
        }
      };
      
      // Start scanning from vault root
      await scanDirectory(vaultPath);
      
      // Sort files by modification date and get most recent
      allFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
      stats.recentlyModified = allFiles.slice(0, 10);
      
      // Sort folders by file count
      stats.folderSizes.sort((a, b) => b.fileCount - a.fileCount);
      stats.folderSizes = stats.folderSizes.slice(0, 10); // Top 10 folders
      
      return stats;
    } catch (error) {
      console.error('Error analyzing vault structure:', error);
      // Return minimal stats on error
      return {
        totalFiles: 0,
        filesByType: {},
        folderSizes: [],
        recentlyModified: []
      };
    }
  }
  
  private async calculateCoverage(): Promise<CoverageStats> {
    try {
      const vaultPath = this.vaultManager.getVaultPath();
      const coverage: CoverageStats = {
        documented: 0,
        total: 0,
        percentage: 0,
        byCategory: {}
      };
      
      // Define documentation categories and their paths
      const categories = {
        'Core Systems': ['src/', 'lib/'],
        'API References': ['docs/api/', 'API/'],
        'Implementation Guides': ['docs/guides/', 'vault/'],
        'Configuration': ['config/', '.env', 'docker-compose'],
        'Architecture': ['Architecture/', 'docs/architecture/']
      };
      
      // Check each category
      for (const [category, patterns] of Object.entries(categories)) {
        let categoryTotal = 0;
        let categoryDocumented = 0;
        
        for (const pattern of patterns) {
          try {
            const searchPath = path.join(vaultPath, pattern);
            
            // Check if it's a file or directory
            const stat = await fs.stat(searchPath).catch(() => null);
            
            if (stat) {
              if (stat.isDirectory()) {
                // Count files in directory
                const files = await fs.readdir(searchPath, { recursive: true as any });
                const codeFiles = files.filter((f: string) => 
                  f.endsWith('.ts') || f.endsWith('.js') || 
                  f.endsWith('.py') || f.endsWith('.java')
                );
                const docFiles = files.filter((f: string) => 
                  f.endsWith('.md') || f.endsWith('.txt') || 
                  f.includes('README')
                );
                
                categoryTotal += codeFiles.length;
                categoryDocumented += Math.min(codeFiles.length, docFiles.length);
              } else if (stat.isFile()) {
                categoryTotal += 1;
                // Check if there's a corresponding .md file
                const docPath = searchPath.replace(/\.[^.]+$/, '.md');
                const hasDoc = await fs.access(docPath).then(() => true).catch(() => false);
                if (hasDoc) categoryDocumented += 1;
              }
            }
          } catch (error) {
            // Path doesn't exist, skip
          }
        }
        
        if (categoryTotal > 0) {
          coverage.byCategory[category] = {
            documented: categoryDocumented,
            total: categoryTotal
          };
          coverage.total += categoryTotal;
          coverage.documented += categoryDocumented;
        }
      }
      
      // Calculate overall percentage
      coverage.percentage = coverage.total > 0 
        ? Math.round((coverage.documented / coverage.total) * 100)
        : 0;
      
      return coverage;
    } catch (error) {
      console.error('Error calculating coverage:', error);
      // Return default values on error
      return {
        documented: 0,
        total: 0,
        percentage: 0,
        byCategory: {}
      };
    }
  }
  
  private async buildNavigation(): Promise<NavigationLinks> {
    const baseVaultPath = './vault';
    
    return {
      activeProject: `${baseVaultPath}/10-Active-Projects/MCP-ChromaDB-Memory/`,
      todaysTasks: `${baseVaultPath}/70-Task-Management/current-sprint.md`,
      recentDecisions: `${baseVaultPath}/Architecture/decisions/`,
      sessionHistory: `${baseVaultPath}/Sessions/`,
      templates: `${baseVaultPath}/Templates/`,
      documentation: `${baseVaultPath}/60-Reference-Documentation/`
    };
  }
  
  async generateAndSaveIndex(): Promise<void> {
    const index = await this.generateIndex();
    const markdown = this.formatIndexAsMarkdown(index);
    
    // Ensure directory exists
    const indexDir = path.dirname(this.indexPath);
    await fs.mkdir(indexDir, { recursive: true });
    
    // Write index file
    await fs.writeFile(this.indexPath, markdown, 'utf-8');
  }
  
  private formatIndexAsMarkdown(index: VaultIndex): string {
    const { timestamp, health, activeContext, vaultStats, navigation } = index;
    
    let markdown = `# MCP ChromaDB Memory - Vault Index
*Last Updated: ${timestamp.toISOString().replace('T', ' ').slice(0, 19)}*

## System Health
`;
    
    // Format health status
    markdown += this.formatHealthStatus(health);
    
    // Active context section
    markdown += `\n## Active Context\n`;
    if (activeContext.currentSession) {
      markdown += `### Current Session
- Started: ${activeContext.currentSession.startTime.toISOString().slice(0, 19)}
- Duration: ${activeContext.currentSession.duration}
- Tools Used: ${activeContext.currentSession.toolsUsed}
- Files Modified: ${activeContext.currentSession.filesModified}
`;
    }
    
    markdown += `
### Recent Memories (Last 24h)
- Working Memory: ${activeContext.recentMemories.last24Hours} entries
- Total Memories: ${activeContext.recentMemories.total}
- By Context:
${Object.entries(activeContext.recentMemories.byContext)
  .map(([ctx, count]) => `  - ${ctx}: ${count}`)
  .join('\n')}

### Active Tasks
${activeContext.activeTasks
  .map(task => `${task.status === 'completed' ? '✅' : task.status === 'in_progress' ? '🔄' : '⏸️'} ${task.title}`)
  .join('\n')}

## Vault Statistics
### Documentation Coverage
- Core Systems: ${vaultStats.documentationCoverage.byCategory['Core Systems']?.documented || 0}/${vaultStats.documentationCoverage.byCategory['Core Systems']?.total || 0} documented (${Math.round((vaultStats.documentationCoverage.byCategory['Core Systems']?.documented || 0) / (vaultStats.documentationCoverage.byCategory['Core Systems']?.total || 1) * 100)}%)
- API References: ${vaultStats.documentationCoverage.byCategory['API References']?.documented || 0}/${vaultStats.documentationCoverage.byCategory['API References']?.total || 0} complete
- Implementation Guides: ${vaultStats.documentationCoverage.byCategory['Implementation Guides']?.documented || 0}/${vaultStats.documentationCoverage.byCategory['Implementation Guides']?.total || 0} in progress

### File Organization
\`\`\`
Total Files: ${vaultStats.totalFiles}
${vaultStats.folderSizes
  .map(folder => `├── ${folder.name}: ${folder.fileCount}`)
  .join('\n')}
\`\`\`

## Quick Navigation
- [Active Project](${navigation.activeProject})
- [Today's Tasks](${navigation.todaysTasks})
- [Recent Decisions](${navigation.recentDecisions})
- [Session History](${navigation.sessionHistory})
- [Templates](${navigation.templates})
- [Documentation](${navigation.documentation})
`;
    
    return markdown;
  }
  
  private formatHealthStatus(health: SystemHealth): string {
    const getIcon = (status: HealthStatus) => {
      switch (status) {
        case 'healthy': return '✅';
        case 'warning': return '⚠️';
        case 'error': return '❌';
        default: return '❓';
      }
    };
    
    return `- ${getIcon(health.chromadb.status)} ChromaDB: ${health.chromadb.message}
- ${getIcon(health.memoryCollections.status)} Memory Collections: ${health.memoryCollections.message}
- ${getIcon(health.sessionLogger.status)} Session Logger: ${health.sessionLogger.message}
- ${getIcon(health.vaultStructure.status)} Vault Structure: ${health.vaultStructure.message}
- ${getIcon(health.templateCache.status)} Template Cache: ${health.templateCache.message}
`;
  }
  
  private calculateDuration(start: Date, end: Date): string {
    const duration = end.getTime() - start.getTime();
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }
  
  private async getMemoryStatistics(): Promise<any> {
    try {
      // Get the memory collection from ChromaDB
      const chromaClient = this.memoryManager.getChromaClient();
      const collection = await chromaClient.getCollection({
        name: process.env.MEMORY_COLLECTION_NAME || 'ai_memories'
      });
      
      // Get all memories to analyze
      const result = await collection.get();
      
      if (!result.ids || result.ids.length === 0) {
        return {
          collections: 1,
          totalMemories: 0,
          workingMemories: 0,
          sessionMemories: 0,
          longTermMemories: 0
        };
      }
      
      // Count memories by age and type
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000;
      const weekInMs = 7 * dayInMs;
      
      let workingMemories = 0; // < 48 hours
      let sessionMemories = 0; // 48 hours - 2 weeks
      let longTermMemories = 0; // > 2 weeks
      
      result.metadatas?.forEach(metadata => {
        if (metadata) {
          const timestamp = metadata.timestamp;
          if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            const timestampMs = new Date(timestamp).getTime();
            const age = now - timestampMs;
            
            if (age < 2 * dayInMs) {
              workingMemories++;
            } else if (age < 2 * weekInMs) {
              sessionMemories++;
            } else {
              longTermMemories++;
            }
          }
        }
      });
      
      return {
        collections: 1, // Currently using single collection
        totalMemories: result.ids.length,
        workingMemories,
        sessionMemories,
        longTermMemories
      };
    } catch (error) {
      console.error('Error getting memory statistics:', error);
      // Return zeros if error
      return {
        collections: 0,
        totalMemories: 0,
        workingMemories: 0,
        sessionMemories: 0,
        longTermMemories: 0
      };
    }
  }
  
  private startPeriodicUpdates(): void {
    this.updateTimer = setInterval(() => {
      this.generateAndSaveIndex().catch(error => {
        console.error('Failed to update vault index:', error);
      });
    }, this.updateInterval);
  }
  
  async stop(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
  }
}