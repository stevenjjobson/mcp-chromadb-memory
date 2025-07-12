#!/usr/bin/env tsx
import { HybridMemoryManager } from './src/hybrid-memory-manager.js';
import { VaultIndexService } from './src/services/vault-index-service.js';
import { MemoryHealthMonitor } from './src/services/memory-health-monitor.js';
import { ObsidianManager } from './src/obsidian-manager.js';
import { SessionLogger } from './src/session-logger.js';
import { VaultStructureManager } from './src/services/vault-structure-manager.js';
import { TemplateManager } from './src/services/template-manager.js';
import { getConfig } from './src/config.js';
import chalk from 'chalk';

async function testHealthCheck() {
  console.log(chalk.blue.bold('\n🔍 MCP ChromaDB Memory - System Health Check\n'));
  
  try {
    const config = getConfig();
    console.log(chalk.green('✓ Configuration loaded successfully'));
    console.log(`  Environment: ${config.environment}`);
    console.log(`  Hybrid Storage: ${config.useHybridStorage}`);
    console.log(`  Tiers Enabled: ${config.tierEnabled}`);
    
    // Test HybridMemoryManager
    console.log(chalk.yellow('\n📊 Testing Hybrid Memory Manager...'));
    const memoryManager = new HybridMemoryManager(config);
    await memoryManager.initialize();
    console.log(chalk.green('✓ Hybrid Memory Manager initialized'));
    
    const stats = await memoryManager.getStats();
    console.log(`  Total Memories: ${stats.totalMemories}`);
    console.log(`  Collections: ${stats.collections.join(', ')}`);
    
    // Test PostgreSQL connection
    if (config.useHybridStorage) {
      console.log(chalk.yellow('\n🐘 Testing PostgreSQL connection...'));
      const pgClient = memoryManager['postgresClient'];
      if (pgClient) {
        const result = await pgClient.query('SELECT NOW()');
        console.log(chalk.green('✓ PostgreSQL connected'));
        console.log(`  Server time: ${result.rows[0].now}`);
      }
    }
    
    // Test ChromaDB connection
    console.log(chalk.yellow('\n🎨 Testing ChromaDB connection...'));
    const chromaClient = memoryManager['client'];
    const heartbeat = await chromaClient.heartbeat();
    console.log(chalk.green('✓ ChromaDB connected'));
    console.log(`  Heartbeat: ${heartbeat}`);
    
    // Test Obsidian Manager
    console.log(chalk.yellow('\n📝 Testing Obsidian Manager...'));
    const obsidianManager = new ObsidianManager(config);
    const vaultExists = await obsidianManager.ensureVaultExists();
    console.log(chalk.green(`✓ Obsidian vault ${vaultExists ? 'exists' : 'created'}`));
    console.log(`  Vault path: ${config.obsidianVaultPath}`);
    
    // Test Session Logger
    console.log(chalk.yellow('\n📹 Testing Session Logger...'));
    const sessionLogger = new SessionLogger(obsidianManager, config);
    console.log(chalk.green('✓ Session Logger initialized'));
    console.log(`  Auto-start: ${config.autoStartSessionLogging}`);
    console.log(`  Project: ${config.sessionLoggingProjectName}`);
    
    // Test Vault Index Service
    console.log(chalk.yellow('\n📊 Testing Vault Index Service...'));
    const vaultIndexService = new VaultIndexService(
      obsidianManager,
      memoryManager,
      sessionLogger,
      null, // templateManager
      null  // vaultStructureManager
    );
    console.log(chalk.green('✓ Vault Index Service initialized'));
    
    // Test Memory Health Monitor
    console.log(chalk.yellow('\n🏥 Testing Memory Health Monitor...'));
    const healthMonitor = new MemoryHealthMonitor(memoryManager);
    const healthReport = await healthMonitor.checkHealth();
    console.log(chalk.green('✓ Memory Health Monitor operational'));
    console.log(`  Fragmentation: ${(healthReport.fragmentationRatio * 100).toFixed(1)}%`);
    console.log(`  Status: ${healthReport.status}`);
    
    console.log(chalk.green.bold('\n✅ All systems operational!\n'));
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Health check failed:'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
  
  process.exit(0);
}

testHealthCheck();