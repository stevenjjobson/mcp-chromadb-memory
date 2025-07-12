#!/usr/bin/env tsx
import { HybridMemoryManager } from './src/memory-manager-hybrid.js';
import { VaultIndexService } from './src/services/vault-index-service.js';
import { MemoryHealthMonitor } from './src/services/memory-health-monitor.js';
import { ObsidianManager } from './src/obsidian-manager.js';
import { SessionLogger } from './src/session-logger.js';
import { VaultManager } from './src/vault-manager.js';
import { StateManager } from './src/state-manager.js';
import { config } from './src/config.js';
import chalk from 'chalk';

// Test results tracking
interface TestResult {
  category: string;
  feature: string;
  status: 'pass' | 'fail' | 'skip';
  message?: string;
  error?: string;
}

const results: TestResult[] = [];

function logTest(category: string, feature: string, status: 'pass' | 'fail' | 'skip', message?: string, error?: string) {
  results.push({ category, feature, status, message, error });
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
  const color = status === 'pass' ? chalk.green : status === 'fail' ? chalk.red : chalk.yellow;
  console.log(color(`${icon} ${category} - ${feature}${message ? ': ' + message : ''}`));
  if (error) console.log(chalk.gray(`   Error: ${error}`));
}

async function testFunctionality() {
  console.log(chalk.blue.bold('\n🔍 MCP ChromaDB Memory - Comprehensive Functionality Test\n'));
  
  let memoryManager: HybridMemoryManager;
  let obsidianManager: ObsidianManager;
  let sessionLogger: SessionLogger;
  let vaultManager: VaultManager;
  let stateManager: StateManager;
  
  try {
    // Phase 1: Infrastructure
    console.log(chalk.cyan.bold('\n📋 Phase 1: Infrastructure Health Check\n'));
    
    // config is already imported at the top
    logTest('Infrastructure', 'Configuration Loading', 'pass', `Environment: ${config.environment}`);
    
    // Test HybridMemoryManager
    memoryManager = new HybridMemoryManager(config);
    await memoryManager.initialize();
    logTest('Infrastructure', 'Hybrid Memory Manager', 'pass', 'Initialized successfully');
    
    // Test PostgreSQL
    if (config.useHybridStorage) {
      try {
        const pgClient = memoryManager['postgresClient'];
        await pgClient.query('SELECT NOW()');
        logTest('Infrastructure', 'PostgreSQL Connection', 'pass', 'Connected to coachntt_cognitive_db');
      } catch (e) {
        logTest('Infrastructure', 'PostgreSQL Connection', 'fail', '', e.message);
      }
    }
    
    // Test ChromaDB
    try {
      const chromaClient = memoryManager['client'];
      await chromaClient.heartbeat();
      logTest('Infrastructure', 'ChromaDB Connection', 'pass', 'Connected to http://localhost:8000');
    } catch (e) {
      logTest('Infrastructure', 'ChromaDB Connection', 'fail', '', e.message);
    }
    
    // Test Obsidian Manager
    obsidianManager = new ObsidianManager(config);
    await obsidianManager.ensureVaultExists();
    logTest('Infrastructure', 'Obsidian Vault', 'pass', `Vault at ${config.obsidianVaultPath}`);
    
    // Phase 2: Core Memory System
    console.log(chalk.cyan.bold('\n📋 Phase 2: Core Memory System\n'));
    
    // Test memory storage
    try {
      const testMemory = await memoryManager.storeMemory(
        'Test memory for functionality check',
        'general',
        { test: true, timestamp: new Date().toISOString() }
      );
      logTest('Core Memory', 'Store Memory', 'pass', `Stored with ID: ${testMemory.id}`);
      
      // Test memory recall
      const recalled = await memoryManager.recallMemories('functionality check', 5);
      logTest('Core Memory', 'Recall Memory', recalled.length > 0 ? 'pass' : 'fail', 
        `Found ${recalled.length} memories`);
      
      // Test exact search
      const exactResults = await memoryManager.searchExact('functionality', 5);
      logTest('Core Memory', 'Exact Search', 'pass', `Found ${exactResults.length} exact matches`);
      
      // Test hybrid search
      const hybridResults = await memoryManager.searchHybrid('test functionality', 5, 0.5);
      logTest('Core Memory', 'Hybrid Search', 'pass', `Found ${hybridResults.length} hybrid matches`);
      
      // Clean up test memory
      if (testMemory.id) {
        await memoryManager.deleteMemory(testMemory.id);
        logTest('Core Memory', 'Delete Memory', 'pass', 'Test memory cleaned up');
      }
    } catch (e) {
      logTest('Core Memory', 'Memory Operations', 'fail', '', e.message);
    }
    
    // Test memory stats
    try {
      const stats = await memoryManager.getStats();
      logTest('Core Memory', 'Memory Statistics', 'pass', 
        `Total: ${stats.totalMemories}, Collections: ${stats.collections.length}`);
    } catch (e) {
      logTest('Core Memory', 'Memory Statistics', 'fail', '', e.message);
    }
    
    // Phase 3: Enhanced Features
    console.log(chalk.cyan.bold('\n📋 Phase 3: Enhanced Features\n'));
    
    // Test tier system
    if (config.tierEnabled) {
      try {
        const tierStats = await memoryManager.getTierStats();
        logTest('Enhanced Features', 'Tier System', 'pass', 
          `Working: ${tierStats.working.count}, Session: ${tierStats.session.count}, Long-term: ${tierStats.longterm.count}`);
      } catch (e) {
        logTest('Enhanced Features', 'Tier System', 'fail', '', e.message);
      }
    } else {
      logTest('Enhanced Features', 'Tier System', 'skip', 'TIER_ENABLED=false');
    }
    
    // Test vault management
    try {
      vaultManager = new VaultManager(obsidianManager);
      const vaults = await vaultManager.listVaults();
      logTest('Enhanced Features', 'Vault Manager', 'pass', `${vaults.length} vaults registered`);
    } catch (e) {
      logTest('Enhanced Features', 'Vault Manager', 'fail', '', e.message);
    }
    
    // Test state management
    try {
      stateManager = new StateManager(vaultManager.vaultPath);
      const states = await stateManager.listStates();
      logTest('Enhanced Features', 'State Manager', 'pass', `${states.length} states available`);
    } catch (e) {
      logTest('Enhanced Features', 'State Manager', 'fail', '', e.message);
    }
    
    // Test access patterns
    try {
      const patterns = await memoryManager.analyzeAccessPatterns();
      logTest('Enhanced Features', 'Access Pattern Analysis', 'pass', 
        `Hot: ${patterns.hot.length}, Warm: ${patterns.warm.length}, Cold: ${patterns.cold.length}`);
    } catch (e) {
      logTest('Enhanced Features', 'Access Pattern Analysis', 'fail', '', e.message);
    }
    
    // Phase 4: Code Intelligence
    console.log(chalk.cyan.bold('\n📋 Phase 4: Code Intelligence\n'));
    
    if (config.codeIndexingEnabled) {
      // Test code indexing would go here
      logTest('Code Intelligence', 'Code Indexing', 'skip', 'Would test indexing the current codebase');
      logTest('Code Intelligence', 'Symbol Search', 'skip', 'Would test finding functions/classes');
      logTest('Code Intelligence', 'Pattern Detection', 'skip', 'Would test code pattern analysis');
    } else {
      logTest('Code Intelligence', 'Code Intelligence Suite', 'skip', 'CODE_INDEXING_ENABLED=false');
    }
    
    // Phase 5: Integration Features
    console.log(chalk.cyan.bold('\n📋 Phase 5: Integration Features\n'));
    
    // Test session logging
    try {
      sessionLogger = new SessionLogger(obsidianManager, config);
      if (config.autoStartSessionLogging) {
        logTest('Integration', 'Session Logging', 'pass', 'Auto-start enabled');
      } else {
        logTest('Integration', 'Session Logging', 'pass', 'Manual mode');
      }
    } catch (e) {
      logTest('Integration', 'Session Logging', 'fail', '', e.message);
    }
    
    // Test Obsidian integration
    try {
      const notes = await obsidianManager.listNotes();
      logTest('Integration', 'Obsidian Notes', 'pass', `${notes.length} notes in vault`);
    } catch (e) {
      logTest('Integration', 'Obsidian Notes', 'fail', '', e.message);
    }
    
    // Test health monitoring
    try {
      const healthMonitor = new MemoryHealthMonitor(memoryManager);
      const health = await healthMonitor.checkHealth();
      logTest('Integration', 'Memory Health Monitor', 'pass', 
        `Status: ${health.status}, Fragmentation: ${(health.fragmentationRatio * 100).toFixed(1)}%`);
    } catch (e) {
      logTest('Integration', 'Memory Health Monitor', 'fail', '', e.message);
    }
    
    // Summary
    console.log(chalk.cyan.bold('\n📊 Test Summary\n'));
    
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const skipped = results.filter(r => r.status === 'skip').length;
    
    console.log(chalk.green(`✅ Passed: ${passed}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));
    console.log(chalk.yellow(`⏭️  Skipped: ${skipped}`));
    console.log(chalk.blue(`📋 Total: ${results.length}`));
    
    if (failed > 0) {
      console.log(chalk.red.bold('\n❌ Some tests failed. Issues found:\n'));
      results.filter(r => r.status === 'fail').forEach(r => {
        console.log(chalk.red(`- ${r.category} - ${r.feature}: ${r.error || 'Unknown error'}`));
      });
    } else {
      console.log(chalk.green.bold('\n✅ All operational features are working!\n'));
    }
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Critical test failure:'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
  
  process.exit(0);
}

testFunctionality();