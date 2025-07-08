#!/usr/bin/env node

/**
 * Startup Health Check Script
 * Used by start-mcp-platform.sh to verify MCP server health
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Configuration
const config = {
  timeout: 30000, // 30 seconds
  chromadbUrl: process.env.CHROMADB_URL || 'http://localhost:8000',
  mcpServerPath: path.join(__dirname, '..', 'dist', 'index.js')
};

// Check if MCP server can start and respond
async function checkMCPServer() {
  return new Promise((resolve, reject) => {
    console.log(`${colors.cyan}Testing MCP server startup...${colors.reset}`);
    
    const mcpProcess = spawn('node', [config.mcpServerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });
    
    let startupComplete = false;
    let healthData = null;
    const timeout = setTimeout(() => {
      if (!startupComplete) {
        mcpProcess.kill();
        reject(new Error('MCP server startup timeout'));
      }
    }, config.timeout);
    
    // Listen for startup messages
    mcpProcess.stderr.on('data', (data) => {
      const output = data.toString();
      
      // Check for startup complete
      if (output.includes('MCP Server running on stdio transport')) {
        startupComplete = true;
        clearTimeout(timeout);
        
        // Send health check request
        const healthRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'get_startup_summary',
            arguments: {}
          }
        };
        
        mcpProcess.stdin.write(JSON.stringify(healthRequest) + '\n');
      }
      
      // Capture startup summary if displayed
      if (output.includes('MCP ChromaDB Memory Platform Started')) {
        const lines = output.split('\n');
        let inSummary = false;
        let summaryLines = [];
        
        for (const line of lines) {
          if (line.includes('MCP ChromaDB Memory Platform Started')) {
            inSummary = true;
          }
          if (inSummary) {
            summaryLines.push(line);
          }
          if (line.includes('Ready to continue')) {
            inSummary = false;
          }
        }
        
        if (summaryLines.length > 0) {
          console.log(colors.green + '\n✅ Startup Summary:\n' + colors.reset);
          console.log(summaryLines.join('\n'));
        }
      }
    });
    
    // Listen for JSON-RPC responses
    let buffer = '';
    mcpProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            if (response.id === 1 && response.result) {
              healthData = response.result;
              
              // Clean shutdown
              mcpProcess.kill();
              clearTimeout(timeout);
              resolve(healthData);
            }
          } catch (e) {
            // Not JSON, ignore
          }
        }
      }
    });
    
    mcpProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    
    mcpProcess.on('exit', (code) => {
      clearTimeout(timeout);
      if (!healthData && code !== 0) {
        reject(new Error(`MCP server exited with code ${code}`));
      }
    });
  });
}

// Check ChromaDB connection
async function checkChromaDB() {
  try {
    const response = await fetch(`${config.chromadbUrl}/api/v1/heartbeat`);
    const data = await response.json();
    
    if (data.nanosecond_heartbeat) {
      // Get collections count
      const collectionsResponse = await fetch(`${config.chromadbUrl}/api/v1/collections`);
      const collections = await collectionsResponse.json();
      
      return {
        status: 'healthy',
        collections: collections.length || 0,
        heartbeat: data.nanosecond_heartbeat
      };
    }
    
    return { status: 'error', message: 'Invalid heartbeat response' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

// Check environment configuration
async function checkEnvironment() {
  const envPath = path.join(__dirname, '..', '.env');
  const results = {
    envFile: false,
    openaiKey: false,
    vaultPath: false,
    vaultExists: false
  };
  
  try {
    // Check .env file
    await fs.access(envPath);
    results.envFile = true;
    
    // Read and parse .env
    const envContent = await fs.readFile(envPath, 'utf-8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim();
      }
    });
    
    // Check required variables
    if (envVars.OPENAI_API_KEY || process.env.OPENAI_API_KEY) {
      results.openaiKey = true;
    }
    
    const vaultPath = envVars.OBSIDIAN_VAULT_PATH || process.env.OBSIDIAN_VAULT_PATH;
    if (vaultPath) {
      results.vaultPath = true;
      try {
        await fs.access(vaultPath);
        results.vaultExists = true;
      } catch {
        results.vaultExists = false;
      }
    }
  } catch (error) {
    // .env doesn't exist
  }
  
  return results;
}

// Display visual health check dashboard
async function displayHealthDashboard() {
  console.log(colors.bright + colors.blue);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          MCP ChromaDB Memory Platform Health Check           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  
  let allHealthy = true;
  
  // Check environment
  console.log(`\n${colors.bright}🔧 Environment Configuration${colors.reset}`);
  console.log('────────────────────────────');
  
  const env = await checkEnvironment();
  
  if (env.envFile) {
    console.log(`${colors.green}✓ .env file found${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ .env file not found${colors.reset}`);
    allHealthy = false;
  }
  
  if (env.openaiKey) {
    console.log(`${colors.green}✓ OpenAI API key configured${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ OpenAI API key not set${colors.reset}`);
    allHealthy = false;
  }
  
  if (env.vaultPath) {
    if (env.vaultExists) {
      console.log(`${colors.green}✓ Obsidian vault found${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠ Obsidian vault path set but not found${colors.reset}`);
    }
  } else {
    console.log(`${colors.yellow}⚠ Obsidian vault path not set${colors.reset}`);
  }
  
  // Check ChromaDB
  console.log(`\n${colors.bright}🧠 ChromaDB Status${colors.reset}`);
  console.log('──────────────────');
  
  const chromadb = await checkChromaDB();
  
  if (chromadb.status === 'healthy') {
    console.log(`${colors.green}✓ ChromaDB is healthy${colors.reset}`);
    console.log(`  Collections: ${chromadb.collections}`);
  } else {
    console.log(`${colors.red}✗ ChromaDB connection failed: ${chromadb.message}${colors.reset}`);
    allHealthy = false;
  }
  
  // Check MCP Server
  console.log(`\n${colors.bright}🚀 MCP Server Test${colors.reset}`);
  console.log('─────────────────');
  
  try {
    const healthData = await checkMCPServer();
    console.log(`${colors.green}✓ MCP server started successfully${colors.reset}`);
    
    // Parse and display health data if available
    if (healthData && healthData.content && healthData.content[0]) {
      try {
        const summary = JSON.parse(healthData.content[0].text);
        if (summary.memoryStatus) {
          console.log(`  Total memories: ${summary.memoryStatus.total}`);
          console.log(`  Working memory load: ${summary.memoryStatus.workingMemoryLoad}%`);
        }
      } catch {
        // Couldn't parse health data
      }
    }
  } catch (error) {
    console.log(`${colors.red}✗ MCP server test failed: ${error.message}${colors.reset}`);
    allHealthy = false;
  }
  
  // Summary
  console.log(`\n${colors.bright}📊 Summary${colors.reset}`);
  console.log('─────────');
  
  if (allHealthy) {
    console.log(`${colors.green}${colors.bright}✅ All systems operational!${colors.reset}`);
    console.log('\nThe MCP ChromaDB Memory Platform is ready to use.');
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bright}❌ Some components need attention${colors.reset}`);
    console.log('\nPlease fix the issues above before starting Claude Desktop.');
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    await displayHealthDashboard();
  } catch (error) {
    console.error(`${colors.red}Error during health check: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run the health check
main();