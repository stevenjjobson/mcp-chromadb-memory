# WSL Startup Guide for MCP ChromaDB Memory Platform

This guide explains how to use the startup script system to ensure all services are running correctly before launching Claude Desktop.

## Overview

The startup script (`start-mcp-platform.sh`) provides a comprehensive health check and initialization system that:

1. Verifies all required services are running
2. Displays a visual health dashboard
3. Performs pre-initialization warm-up
4. Optionally launches Claude Desktop when ready

## Quick Start

```bash
# Make the script executable (first time only)
chmod +x start-mcp-platform.sh

# Run the startup script
./start-mcp-platform.sh
```

## What the Script Checks

### 1. WSL Environment
- Verifies you're running in WSL
- Checks for required Linux utilities

### 2. Docker Status
- Ensures Docker daemon is running
- Checks Docker version
- Offers to start Docker if not running

### 3. ChromaDB
- Verifies ChromaDB container exists
- Checks if container is running
- Tests ChromaDB API health
- Displays collection count
- Automatically starts container if needed

### 4. MCP Server
- Checks for required files (package.json, .env)
- Installs dependencies if needed
- Builds TypeScript if needed
- Runs comprehensive health check
- Tests actual MCP server startup

### 5. Environment Configuration
- Validates .env file exists
- Checks for required API keys
- Verifies Obsidian vault path

### 6. Pre-initialization
- Warms up ChromaDB with test queries
- Checks for old memories that need cleanup
- Optimizes startup performance

## Configuration

### Creating Your Configuration

```bash
# Copy the example configuration
cp .mcp-startup.conf.example ~/.mcp-startup.conf

# Edit with your preferences
nano ~/.mcp-startup.conf
```

### Key Configuration Options

```bash
# ChromaDB settings
CHROMADB_URL="http://localhost:8000"
CHROMADB_CONTAINER="chromadb-memory"

# Auto-launch Claude Desktop after successful startup
AUTO_LAUNCH_CLAUDE=true

# Path to Claude Desktop (update for your system)
CLAUDE_DESKTOP_PATH="/mnt/c/Users/$USER/AppData/Local/AnthropicClaude/Claude.exe"

# Skip warm-up for faster startup
SKIP_WARMUP=false

# Retry settings
MAX_RETRIES=5
RETRY_DELAY=2
```

## Visual Dashboard

The script displays a comprehensive health dashboard:

```
╔══════════════════════════════════════════════════════════════╗
║           MCP ChromaDB Memory Platform Startup               ║
║                    Health Check Dashboard                     ║
╚══════════════════════════════════════════════════════════════╝

🐳 Docker Status
─────────────────
✓ Docker daemon is running
ℹ Docker version: 24.0.7

🧠 ChromaDB Status
──────────────────
✓ ChromaDB container is running
✓ ChromaDB API is responding
ℹ ChromaDB collections: 1

🚀 MCP Server Status
────────────────────
✓ Dependencies are installed
✓ TypeScript build found
✓ MCP server health check passed

📊 Startup Summary
─────────────────
  Duration: 8s
  Errors: 0
  Warnings: 0

✅ All systems operational!
```

## Troubleshooting

### Common Issues

#### Docker Not Running
```bash
# Start Docker daemon
sudo service docker start

# Or let the script fix it automatically
# Answer 'y' when prompted
```

#### ChromaDB Container Missing
```bash
# Navigate to docker-compose directory
cd ../aoe-mcp-personal

# Start ChromaDB
docker-compose up -d chromadb
```

#### Missing Dependencies
```bash
# The script will automatically run:
npm install
npm run build
```

#### Environment Variables
```bash
# Ensure .env file exists
cp .env.example .env

# Edit and add your API keys
nano .env
```

## Advanced Usage

### Custom Pre/Post Scripts

Add to your `~/.mcp-startup.conf`:

```bash
# Run custom initialization
PRE_STARTUP_SCRIPT="/path/to/init-script.sh"

# Run after successful startup
POST_STARTUP_SCRIPT="/path/to/notify-script.sh"
```

### Logging

All startup activities are logged to:
```
/tmp/mcp-startup-YYYYMMDD-HHMMSS.log
```

View logs:
```bash
# View latest log
ls -t /tmp/mcp-startup-*.log | head -1 | xargs cat

# Follow log in real-time during startup
tail -f /tmp/mcp-startup-*.log
```

### Running Individual Checks

```bash
# Test only ChromaDB warm-up
node scripts/warm-chromadb.js

# Test only health check
node scripts/startup-health-check.js
```

## Integration with Claude Desktop

### Automatic Launch

Set in your configuration:
```bash
AUTO_LAUNCH_CLAUDE=true
```

### Manual Launch

After successful startup:
1. Open Claude Desktop
2. The MCP server will be ready to accept connections
3. Check the startup summary for system status

## Best Practices

1. **Run Before Each Session**: Ensures all services are ready
2. **Check Logs on Failure**: Detailed error information in log files
3. **Keep Services Updated**: Regularly update Docker images
4. **Monitor Memory Usage**: Check the memory statistics displayed
5. **Clean Up Periodically**: Use the cleanup recommendations

## Creating an Alias

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# MCP Platform startup
alias mcp-start='cd /mnt/c/Users/Steve/Dockers/mcp-chromadb-memory && ./start-mcp-platform.sh'

# Quick status check
alias mcp-status='cd /mnt/c/Users/Steve/Dockers/mcp-chromadb-memory && node scripts/startup-health-check.js'
```

Then use:
```bash
mcp-start  # Start the platform
mcp-status # Quick health check
```

## Scheduled Startup

For automatic startup, add to crontab:

```bash
# Edit crontab
crontab -e

# Add this line for startup on boot
@reboot sleep 30 && /path/to/start-mcp-platform.sh >> /tmp/mcp-autostart.log 2>&1
```

## Next Steps

1. Configure your preferences in `~/.mcp-startup.conf`
2. Run the startup script before using Claude Desktop
3. Monitor the health dashboard for any issues
4. Check logs if problems occur

---

For more information, see:
- [HEALTH_MONITORING.md](./HEALTH_MONITORING.md) - Health monitoring details
- [README.md](./README.md) - General platform documentation
- [CLAUDE.md](./CLAUDE.md) - Claude-specific instructions