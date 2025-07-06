# Docker Container Cleanup Instructions

## Background

During development, there was confusion between two separate Docker projects:
- `aoe-mcp-personal` - A different project with its own ChromaDB container
- `mcp-chromadb-memory` - This project with its own ChromaDB container

This led to duplicate containers and conflicting configurations.

## Current State

The following containers exist in your Docker environment:
- `chromadb` - Running but unhealthy (from aoe-mcp-personal project)
- `chromadb-memory` - Exited (from this project - the correct one)
- `mcp-memory-server` - Exited (MCP server test container)

## Cleanup Steps

### 1. Stop Conflicting Containers

```bash
# Stop the conflicting chromadb container from aoe-mcp-personal
docker stop chromadb

# Remove it if you no longer need it
docker rm chromadb
```

### 2. Clean Up Unused Networks (Optional)

If you no longer need the aoe-mcp-personal project:

```bash
# Remove the unused network
docker network rm aoe-mcp-personal_default
```

### 3. Start This Project's ChromaDB

```bash
# From the mcp-chromadb-memory directory
cd /mnt/c/Users/Steve/Dockers/mcp-chromadb-memory

# Start the correct ChromaDB container
docker-compose up -d chromadb
```

### 4. Verify Correct Setup

```bash
# Check that chromadb-memory is running
docker ps | grep chromadb-memory

# Test ChromaDB is accessible
curl http://localhost:8000/api/v1/heartbeat
```

### 5. Update User Configuration

If you have a custom configuration file at `~/.mcp-startup.conf`, update it:

```bash
# Edit the file
nano ~/.mcp-startup.conf

# Change these lines:
CHROMADB_CONTAINER="chromadb-memory"
DOCKER_COMPOSE_DIR="."
```

## Container Reference

### This Project's Containers:
- **chromadb-memory**: The ChromaDB vector database (port 8000)
- **mcp-memory-server**: Optional MCP server container (usually not needed as Claude Desktop runs its own)

### What NOT to Use:
- Any containers with `aoe-mcp-personal` in the name
- The standalone `chromadb` container (without `-memory` suffix)

## Verification

After cleanup, run the startup script to verify everything is working:

```bash
./start-mcp-platform.sh
```

The script should now correctly identify and use the `chromadb-memory` container.