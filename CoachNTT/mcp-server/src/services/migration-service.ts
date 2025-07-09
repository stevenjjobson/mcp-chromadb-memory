import { EnhancedMemoryManager } from '../memory-manager-enhanced.js';
import { HybridMemoryManager } from '../memory-manager-hybrid.js';
import { Config } from '../config.js';

export interface MigrationReport {
  startTime: Date;
  endTime: Date;
  totalMigrated: number;
  migrations: {
    fromTier: string;
    toTier: string;
    count: number;
    memoryIds: string[];
  }[];
  errors: string[];
}

export class MigrationService {
  private scheduler: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastMigration: Date | null = null;
  
  constructor(
    private memoryManager: EnhancedMemoryManager | HybridMemoryManager,
    private config: Config
  ) {}
  
  async start(): Promise<void> {
    if (!this.config.tierEnabled) {
      console.error('Migration service requires tiers to be enabled');
      return;
    }
    
    if (this.scheduler) {
      console.error('Migration service already running');
      return;
    }
    
    const interval = this.config.tierConfig?.migrationInterval || 3600000; // Default 1 hour
    
    console.error(`🔄 Starting migration service (interval: ${interval / 1000 / 60} minutes)`);
    
    // Run initial migration
    await this.runMigration();
    
    // Schedule periodic migrations
    this.scheduler = setInterval(async () => {
      if (!this.isRunning) {
        await this.runMigration();
      }
    }, interval);
  }
  
  async stop(): Promise<void> {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
      console.error('🛑 Migration service stopped');
    }
  }
  
  async runMigration(): Promise<MigrationReport> {
    if (this.isRunning) {
      console.error('Migration already in progress');
      return this.createEmptyReport();
    }
    
    this.isRunning = true;
    const startTime = new Date();
    const report: MigrationReport = {
      startTime,
      endTime: new Date(),
      totalMigrated: 0,
      migrations: [],
      errors: []
    };
    
    try {
      console.error('🔍 Checking for memories to migrate...');
      
      // Get memories that need migration
      const candidatesForMigration = await this.memoryManager.getMemoriesForMigration();
      
      if (candidatesForMigration.length === 0) {
        console.error('✅ No memories need migration');
        this.lastMigration = new Date();
        report.endTime = new Date();
        return report;
      }
      
      console.error(`📦 Found ${candidatesForMigration.length} memories to migrate`);
      
      // Group by migration path
      const migrationGroups = new Map<string, typeof candidatesForMigration>();
      
      for (const candidate of candidatesForMigration) {
        const key = `${candidate.currentTier}->${candidate.targetTier}`;
        if (!migrationGroups.has(key)) {
          migrationGroups.set(key, []);
        }
        migrationGroups.get(key)!.push(candidate);
      }
      
      // Process each migration group
      for (const [path, memories] of migrationGroups) {
        const [fromTier, toTier] = path.split('->');
        const migrationResult = {
          fromTier,
          toTier,
          count: 0,
          memoryIds: [] as string[]
        };
        
        console.error(`🚀 Migrating ${memories.length} memories from ${fromTier} to ${toTier}`);
        
        // Batch process migrations
        const batchSize = 10;
        for (let i = 0; i < memories.length; i += batchSize) {
          const batch = memories.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async ({ memory, currentTier, targetTier }) => {
            try {
              const success = await this.memoryManager.migrateMemory(
                memory.id,
                currentTier as any,
                targetTier as any
              );
              
              if (success) {
                migrationResult.count++;
                migrationResult.memoryIds.push(memory.id);
                report.totalMigrated++;
              } else {
                report.errors.push(`Failed to migrate ${memory.id} from ${currentTier} to ${targetTier}`);
              }
            } catch (error) {
              const errorMsg = `Error migrating ${memory.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              console.error(errorMsg);
              report.errors.push(errorMsg);
            }
          }));
          
          // Progress update
          if (i + batchSize < memories.length) {
            console.error(`  Progress: ${i + batchSize}/${memories.length}`);
          }
        }
        
        report.migrations.push(migrationResult);
      }
      
      // Log summary
      console.error(`✅ Migration complete: ${report.totalMigrated} memories migrated`);
      if (report.errors.length > 0) {
        console.error(`⚠️  ${report.errors.length} errors occurred during migration`);
      }
      
    } catch (error) {
      const errorMsg = `Migration service error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      report.errors.push(errorMsg);
    } finally {
      this.isRunning = false;
      this.lastMigration = new Date();
      report.endTime = new Date();
    }
    
    return report;
  }
  
  private createEmptyReport(): MigrationReport {
    return {
      startTime: new Date(),
      endTime: new Date(),
      totalMigrated: 0,
      migrations: [],
      errors: []
    };
  }
  
  getStatus(): {
    isRunning: boolean;
    lastMigration: Date | null;
    nextMigration: Date | null;
  } {
    let nextMigration = null;
    
    if (this.scheduler && this.lastMigration) {
      const interval = this.config.tierConfig?.migrationInterval || 3600000;
      nextMigration = new Date(this.lastMigration.getTime() + interval);
    }
    
    return {
      isRunning: this.isRunning,
      lastMigration: this.lastMigration,
      nextMigration
    };
  }
}