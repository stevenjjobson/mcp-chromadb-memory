#!/usr/bin/env node

/**
 * Enhanced Dashboard Display for MCP Platform
 * Provides rich visual feedback during startup
 */

import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import Table from 'cli-table3';
import { performance } from 'perf_hooks';

// Dashboard state
const state = {
  startTime: performance.now(),
  checks: [],
  errors: 0,
  warnings: 0
};

// Health status symbols
const symbols = {
  success: chalk.green('✓'),
  error: chalk.red('✗'),
  warning: chalk.yellow('⚠'),
  info: chalk.blue('ℹ'),
  pending: chalk.gray('○'),
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
};

// Dashboard display class
export class DashboardDisplay {
  constructor() {
    this.spinners = new Map();
  }

  // Display header
  showHeader() {
    console.clear();
    const header = boxen(
      chalk.bold.blue('MCP ChromaDB Memory Platform\n') +
      chalk.cyan('Startup Health Check Dashboard'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'blue'
      }
    );
    console.log(header);
  }

  // Start a check with spinner
  startCheck(id, label) {
    const spinner = ora({
      text: label,
      spinner: 'dots',
      color: 'cyan'
    }).start();
    
    this.spinners.set(id, spinner);
    state.checks.push({
      id,
      label,
      status: 'pending',
      startTime: performance.now()
    });
  }

  // Update check status
  updateCheck(id, status, message, details = {}) {
    const spinner = this.spinners.get(id);
    const check = state.checks.find(c => c.id === id);
    
    if (!spinner || !check) return;
    
    check.status = status;
    check.endTime = performance.now();
    check.duration = Math.round(check.endTime - check.startTime);
    check.message = message;
    check.details = details;
    
    switch (status) {
      case 'success':
        spinner.succeed(chalk.green(message));
        break;
      case 'error':
        spinner.fail(chalk.red(message));
        state.errors++;
        break;
      case 'warning':
        spinner.warn(chalk.yellow(message));
        state.warnings++;
        break;
      case 'info':
        spinner.info(chalk.blue(message));
        break;
    }
    
    this.spinners.delete(id);
  }

  // Display system health table
  showHealthTable(healthData) {
    const table = new Table({
      head: [
        chalk.bold('Component'),
        chalk.bold('Status'),
        chalk.bold('Details'),
        chalk.bold('Latency')
      ],
      style: {
        head: ['cyan'],
        border: ['gray']
      }
    });

    // Add rows for each component
    const components = [
      {
        name: 'Docker',
        status: healthData.docker?.status || 'unknown',
        details: healthData.docker?.version || 'N/A',
        latency: 'N/A'
      },
      {
        name: 'ChromaDB',
        status: healthData.chromadb?.status || 'unknown',
        details: `${healthData.chromadb?.collections || 0} collections`,
        latency: healthData.chromadb?.latency ? `${healthData.chromadb.latency}ms` : 'N/A'
      },
      {
        name: 'Memory System',
        status: healthData.memory?.status || 'unknown',
        details: `${healthData.memory?.total || 0} memories`,
        latency: healthData.memory?.queryTime ? `${healthData.memory.queryTime}ms` : 'N/A'
      },
      {
        name: 'Vault',
        status: healthData.vault?.status || 'unknown',
        details: healthData.vault?.path || 'Not configured',
        latency: 'N/A'
      }
    ];

    components.forEach(comp => {
      const statusSymbol = comp.status === 'healthy' ? symbols.success :
                          comp.status === 'error' ? symbols.error :
                          comp.status === 'warning' ? symbols.warning :
                          symbols.pending;
      
      table.push([
        comp.name,
        `${statusSymbol} ${comp.status}`,
        comp.details,
        comp.latency
      ]);
    });

    console.log('\n' + chalk.bold('System Health Status'));
    console.log(table.toString());
  }

  // Display memory statistics
  showMemoryStats(stats) {
    const memoryBox = boxen(
      chalk.bold('Memory Statistics\n\n') +
      `Total Memories: ${chalk.cyan(stats.total || 0)}\n` +
      `Working Memory: ${chalk.green(stats.working || 0)} (last 48h)\n` +
      `Session Memory: ${chalk.yellow(stats.session || 0)} (2-14 days)\n` +
      `Long-term Memory: ${chalk.blue(stats.longTerm || 0)} (>14 days)\n` +
      `\nMemory Load: ${this.getLoadBar(stats.load || 0)}`,
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    );
    console.log('\n' + memoryBox);
  }

  // Display active tasks
  showActiveTasks(tasks) {
    if (!tasks || tasks.length === 0) {
      console.log(chalk.gray('\nNo active tasks found'));
      return;
    }

    console.log('\n' + chalk.bold('Active Tasks'));
    console.log(chalk.gray('─'.repeat(50)));
    
    tasks.forEach((task, index) => {
      const icon = task.status === 'completed' ? symbols.success :
                   task.status === 'in_progress' ? chalk.yellow('🔄') :
                   symbols.pending;
      
      const priority = task.priority === 'high' ? chalk.red('[HIGH]') :
                      task.priority === 'medium' ? chalk.yellow('[MED]') :
                      chalk.gray('[LOW]');
      
      console.log(`${icon} ${priority} ${task.title}`);
    });
  }

  // Display recommendations
  showRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) return;

    const recBox = boxen(
      chalk.bold.yellow('💡 Recommendations\n\n') +
      recommendations.map(rec => `• ${rec}`).join('\n'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      }
    );
    console.log('\n' + recBox);
  }

  // Display final summary
  showSummary() {
    const duration = Math.round((performance.now() - state.startTime) / 1000);
    const success = state.errors === 0;
    
    const summaryBox = boxen(
      chalk.bold('Startup Summary\n\n') +
      `Duration: ${chalk.cyan(duration + 's')}\n` +
      `Checks: ${chalk.green(state.checks.length)}\n` +
      `Errors: ${state.errors > 0 ? chalk.red(state.errors) : chalk.green(state.errors)}\n` +
      `Warnings: ${state.warnings > 0 ? chalk.yellow(state.warnings) : chalk.green(state.warnings)}\n\n` +
      (success ? 
        chalk.green.bold('✅ All systems operational!') :
        chalk.red.bold(`❌ ${state.errors} error(s) detected`)),
      {
        padding: 1,
        margin: 1,
        borderStyle: success ? 'round' : 'single',
        borderColor: success ? 'green' : 'red'
      }
    );
    
    console.log('\n' + summaryBox);
    
    if (success) {
      console.log(chalk.green('\nThe MCP ChromaDB Memory Platform is ready to use.'));
      console.log(chalk.gray('You can now start Claude Desktop to connect.\n'));
    } else {
      console.log(chalk.red('\nPlease fix the errors above before proceeding.\n'));
    }
  }

  // Helper: Create load bar visualization
  getLoadBar(percentage) {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const color = percentage > 80 ? chalk.red :
                  percentage > 60 ? chalk.yellow :
                  chalk.green;
    
    return color('█'.repeat(filled)) + 
           chalk.gray('░'.repeat(empty)) + 
           ` ${percentage}%`;
  }

  // Display error details
  showError(error) {
    const errorBox = boxen(
      chalk.red.bold('Error Details\n\n') +
      chalk.red(error.message || error),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'red'
      }
    );
    console.log('\n' + errorBox);
  }
}

// Example usage (for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  const dashboard = new DashboardDisplay();
  
  // Demo sequence
  async function demo() {
    dashboard.showHeader();
    
    // Simulate checks
    dashboard.startCheck('docker', 'Checking Docker status...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    dashboard.updateCheck('docker', 'success', 'Docker is running', { version: '24.0.7' });
    
    dashboard.startCheck('chromadb', 'Checking ChromaDB...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    dashboard.updateCheck('chromadb', 'success', 'ChromaDB is healthy', { collections: 1, latency: 8 });
    
    dashboard.startCheck('mcp', 'Testing MCP server...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    dashboard.updateCheck('mcp', 'success', 'MCP server ready');
    
    // Show additional info
    dashboard.showHealthTable({
      docker: { status: 'healthy', version: '24.0.7' },
      chromadb: { status: 'healthy', collections: 1, latency: 8 },
      memory: { status: 'healthy', total: 1247, queryTime: 45 },
      vault: { status: 'healthy', path: './Project_Context/vault' }
    });
    
    dashboard.showMemoryStats({
      total: 1247,
      working: 89,
      session: 234,
      longTerm: 924,
      load: 32
    });
    
    dashboard.showActiveTasks([
      { title: 'Implement hierarchical memory system', status: 'in_progress', priority: 'high' },
      { title: 'Create vault index system', status: 'completed', priority: 'high' },
      { title: 'Develop pattern recognition', status: 'pending', priority: 'medium' }
    ]);
    
    dashboard.showRecommendations([
      'Consider running memory consolidation (15% fragmentation detected)',
      'ChromaDB query cache is 87% full - cleanup recommended'
    ]);
    
    dashboard.showSummary();
  }
  
  demo().catch(console.error);
}

export default DashboardDisplay;