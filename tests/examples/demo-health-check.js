#!/usr/bin/env node

/**
 * MCP ChromaDB Memory Platform - Health Check Demo
 * 
 * This script demonstrates how to use the platform health monitoring tools
 * through the MCP protocol.
 * 
 * Prerequisites:
 * 1. ChromaDB must be running (docker-compose up -d chromadb)
 * 2. OPENAI_API_KEY must be set in environment
 * 3. The MCP server must be built (npm run build)
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper to format console output
function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

// Helper to format JSON output
function logJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

// Simulate MCP tool calls (in real usage, these would go through the MCP protocol)
async function simulateToolCall(toolName, args = {}) {
  log(`\n${colors.bright}═══ Calling Tool: ${toolName} ═══${colors.reset}`, colors.cyan);
  
  // In a real implementation, this would communicate with the MCP server
  // For demo purposes, we'll show what the responses would look like
  
  switch (toolName) {
    case 'get_startup_summary':
      return {
        success: true,
        summary: {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          health: {
            overall: 'healthy',
            components: {
              'ChromaDB': 'Connected',
              'Obsidian Vault': 'Connected',
              'Session Logger': 'Active (MCP ChromaDB Memory)'
            },
            warnings: [],
            errors: []
          },
          context: {
            totalMemories: 1247,
            recentMemories: 47,
            workingMemoryLoad: 32,
            activeTasks: [
              { id: '1', title: 'Implement vault index system', status: 'completed', priority: 'high' },
              { id: '2', title: 'Create startup visibility', status: 'completed', priority: 'high' },
              { id: '3', title: 'Develop hierarchical memory system', status: 'pending', priority: 'medium' }
            ],
            projectSummary: 'MCP ChromaDB Memory Platform - Cognitive State Management'
          },
          recommendations: []
        }
      };
      
    case 'get_vault_index':
      if (args.format === 'markdown') {
        return {
          success: true,
          indexPath: 'Project_Context/vault/VAULT_INDEX.md',
          message: 'Vault index available at the specified path',
          summary: {
            health: 'healthy',
            totalMemories: 1247,
            activeTasks: 3
          }
        };
      }
      return {
        timestamp: new Date().toISOString(),
        health: {
          chromadb: { status: 'healthy', message: 'Connected (12ms latency)' },
          memoryCollections: {
            status: 'healthy',
            message: '3 active collections (1247 memories)',
            collections: 3,
            totalMemories: 1247,
            workingMemories: 47,
            sessionMemories: 89,
            longTermMemories: 1111
          },
          sessionLogger: { status: 'healthy', message: 'Active (Project: MCP ChromaDB Memory)' },
          vaultStructure: { status: 'healthy', message: 'Vault structure loaded' },
          templateCache: { status: 'warning', message: '87% full (cleanup recommended)', percentUsed: 87 },
          overall: 'healthy'
        },
        activeContext: {
          currentSession: {
            id: '2025-01-06-session',
            startTime: new Date(Date.now() - 3600000).toISOString(),
            duration: '1h 0m',
            project: 'MCP ChromaDB Memory',
            toolsUsed: 23,
            filesModified: 8
          },
          recentMemories: {
            last24Hours: 47,
            lastWeek: 312,
            total: 1247,
            byContext: {
              general: 856,
              user_preference: 123,
              task_critical: 89,
              obsidian_note: 179
            }
          },
          activeTasks: [
            { id: '1', title: 'Implement vault index system', status: 'completed', priority: 'high' },
            { id: '2', title: 'Create startup visibility', status: 'completed', priority: 'high' },
            { id: '3', title: 'Develop hierarchical memory system', status: 'pending', priority: 'medium' }
          ]
        },
        vaultStats: {
          totalFiles: 127,
          filesByType: { '.md': 89, '.json': 12, '.yaml': 8, '.ts': 15, '.txt': 3 },
          documentationCoverage: {
            documented: 12,
            total: 15,
            percentage: 80
          }
        }
      };
      
    case 'check_memory_health':
      return {
        success: true,
        health: {
          fragmentation: {
            status: 'healthy',
            percentage: 12,
            details: {
              totalMemories: 1247,
              fragmentedMemories: 150,
              averageGap: 3600
            }
          },
          duplicates: {
            count: 23,
            groups: 7
          },
          orphaned: {
            count: 45,
            examples: [
              { id: 'mem_1234_abc', reason: 'Not accessed in 30 days with low importance' },
              { id: 'mem_5678_def', reason: 'Never accessed after 7 days' },
              { id: 'mem_9012_ghi', reason: 'Very low importance with minimal access' }
            ]
          },
          performance: {
            avgQueryTime: 45,
            slowQueries: 3,
            queryCount: 1523,
            indexingSpeed: 150
          }
        },
        recommendations: [
          'Found 23 duplicate memories - consider deduplication',
          '45 orphaned memories detected - review and clean up',
          'Memory system is mostly healthy - continue monitoring'
        ]
      };
      
    case 'regenerate_index':
      return {
        success: true,
        message: 'Vault index regenerated successfully',
        indexPath: 'Project_Context/vault/VAULT_INDEX.md',
        timestamp: new Date().toISOString()
      };
      
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// Main demo function
async function runHealthCheckDemo() {
  log('\n╔══════════════════════════════════════════════════════════════╗', colors.bright);
  log('║     MCP ChromaDB Memory Platform - Health Check Demo         ║', colors.bright);
  log('╚══════════════════════════════════════════════════════════════╝', colors.bright);
  
  // 1. Get Startup Summary
  log('\n1. Getting Startup Summary...', colors.yellow);
  const startupSummary = await simulateToolCall('get_startup_summary');
  
  log('\n📊 System Overview:', colors.green);
  log(`Version: ${startupSummary.summary.version}`);
  log(`Health Status: ${startupSummary.summary.health.overall === 'healthy' ? '✅' : '❌'} ${startupSummary.summary.health.overall}`);
  
  log('\n🔧 Component Status:', colors.green);
  Object.entries(startupSummary.summary.health.components).forEach(([component, status]) => {
    log(`  - ${component}: ${status}`);
  });
  
  log('\n📈 Memory Statistics:', colors.green);
  log(`  - Total Memories: ${startupSummary.summary.context.totalMemories}`);
  log(`  - Recent (24h): ${startupSummary.summary.context.recentMemories}`);
  log(`  - Working Memory Load: ${startupSummary.summary.context.workingMemoryLoad}%`);
  
  // 2. Get Vault Index
  log('\n\n2. Getting Vault Index...', colors.yellow);
  const vaultIndex = await simulateToolCall('get_vault_index', { format: 'json' });
  
  log('\n📁 Vault Statistics:', colors.green);
  log(`  - Total Files: ${vaultIndex.vaultStats.totalFiles}`);
  log(`  - Documentation Coverage: ${vaultIndex.vaultStats.documentationCoverage.percentage}%`);
  log('\n  File Types:', colors.dim);
  Object.entries(vaultIndex.vaultStats.filesByType).forEach(([type, count]) => {
    log(`    ${type}: ${count} files`);
  });
  
  log('\n⏰ Current Session:', colors.green);
  if (vaultIndex.activeContext.currentSession) {
    log(`  - Duration: ${vaultIndex.activeContext.currentSession.duration}`);
    log(`  - Tools Used: ${vaultIndex.activeContext.currentSession.toolsUsed}`);
    log(`  - Files Modified: ${vaultIndex.activeContext.currentSession.filesModified}`);
  }
  
  // 3. Check Memory Health
  log('\n\n3. Checking Memory Health...', colors.yellow);
  const memoryHealth = await simulateToolCall('check_memory_health', { includeRecommendations: true });
  
  log('\n🧠 Memory Health Analysis:', colors.green);
  log(`  - Fragmentation: ${memoryHealth.health.fragmentation.percentage}% (${memoryHealth.health.fragmentation.status})`);
  log(`  - Duplicate Memories: ${memoryHealth.health.duplicates.count} in ${memoryHealth.health.duplicates.groups} groups`);
  log(`  - Orphaned Memories: ${memoryHealth.health.orphaned.count}`);
  
  log('\n⚡ Performance Metrics:', colors.green);
  log(`  - Average Query Time: ${memoryHealth.health.performance.avgQueryTime}ms`);
  log(`  - Slow Queries: ${memoryHealth.health.performance.slowQueries}`);
  log(`  - Total Queries: ${memoryHealth.health.performance.queryCount}`);
  log(`  - Indexing Speed: ${memoryHealth.health.performance.indexingSpeed} memories/second`);
  
  if (memoryHealth.recommendations && memoryHealth.recommendations.length > 0) {
    log('\n💡 Recommendations:', colors.yellow);
    memoryHealth.recommendations.forEach(rec => {
      log(`  • ${rec}`, colors.dim);
    });
  }
  
  // 4. Demonstrate Index Regeneration
  log('\n\n4. Regenerating Vault Index...', colors.yellow);
  const regenerateResult = await simulateToolCall('regenerate_index');
  log(`✅ ${regenerateResult.message}`, colors.green);
  log(`   Index Path: ${regenerateResult.indexPath}`, colors.dim);
  log(`   Timestamp: ${regenerateResult.timestamp}`, colors.dim);
  
  // Summary
  log('\n\n═══════════════════════════════════════════════════════════════', colors.bright);
  log('                        HEALTH CHECK COMPLETE                    ', colors.bright);
  log('═══════════════════════════════════════════════════════════════', colors.bright);
  
  log('\n📋 Summary:', colors.cyan);
  log('  ✅ All systems operational', colors.green);
  log('  ⚠️  Template cache needs cleanup (87% full)', colors.yellow);
  log('  💡 23 duplicate memories could be consolidated', colors.yellow);
  log('  📊 Platform is healthy and ready for use', colors.green);
  
  log('\n🔗 Quick Actions:', colors.cyan);
  log('  - View full index: Project_Context/vault/VAULT_INDEX.md');
  log('  - Run memory cleanup: Use deduplication tools');
  log('  - Monitor performance: Check metrics regularly');
  log('  - Review orphaned memories: Clean up old data');
}

// Interactive mode for exploring specific health aspects
async function interactiveMode() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (query) => new Promise((resolve) => rl.question(query, resolve));
  
  log('\n🔍 Interactive Health Check Mode', colors.cyan);
  log('Commands: summary, vault, memory, regenerate, quit\n', colors.dim);
  
  while (true) {
    const command = await question(`${colors.cyan}health> ${colors.reset}`);
    
    switch (command.trim().toLowerCase()) {
      case 'summary':
        const summary = await simulateToolCall('get_startup_summary');
        logJson(summary);
        break;
        
      case 'vault':
        const vault = await simulateToolCall('get_vault_index', { format: 'json' });
        logJson(vault);
        break;
        
      case 'memory':
        const memory = await simulateToolCall('check_memory_health');
        logJson(memory);
        break;
        
      case 'regenerate':
        const regen = await simulateToolCall('regenerate_index');
        logJson(regen);
        break;
        
      case 'quit':
      case 'exit':
        rl.close();
        return;
        
      default:
        log('Unknown command. Try: summary, vault, memory, regenerate, quit', colors.yellow);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--interactive') || args.includes('-i')) {
    await interactiveMode();
  } else {
    await runHealthCheckDemo();
    
    log('\n\n💡 Tip: Run with --interactive flag for interactive mode', colors.dim);
  }
}

// Run the demo
main().catch(error => {
  log(`\n❌ Error: ${error.message}`, colors.red);
  process.exit(1);
});