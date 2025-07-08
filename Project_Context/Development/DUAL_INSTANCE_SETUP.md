# Dual-Instance Development Setup

## Overview

To safely develop the hierarchical memory system without affecting our production memories (the ones storing our actual development sessions), we've implemented a complete dual-instance setup.

## Architecture

### PRODUCTION Environment
- **Purpose**: Stores our actual development sessions and memories
- **Container**: `chromadb-memory` (existing)
- **Port**: 8000
- **Data**: `./data/chroma/`
- **Collection**: `ai_memories_PRODUCTION`
- **Config**: `.env.PRODUCTION`
- **Features**: All stable features only

### DEVELOPMENT Environment
- **Purpose**: Safe testing ground for hierarchical memory
- **Container**: `chromadb-DEVELOPMENT`
- **Port**: 8001
- **Data**: `./data/chroma-DEVELOPMENT/`
- **Collection**: `ai_memories_DEVELOPMENT`
- **Config**: `.env.DEVELOPMENT`
- **Features**: Experimental features enabled

## Usage

### Starting Development Environment
```bash
./scripts/env-manager.sh start-dev
```

### Checking Status
```bash
./scripts/env-manager.sh status
```

### Testing in Development
```bash
./scripts/test-hierarchical.sh
# OR
./scripts/env-manager.sh test-dev
```

### Stopping Development
```bash
./scripts/env-manager.sh stop-dev
```

## How It Works

1. **Complete Isolation**: Each environment has:
   - Separate ChromaDB instance
   - Separate data directory
   - Separate configuration
   - Separate network

2. **Visual Indicators**: When running, you'll see:
   - 🏭 PRODUCTION - for production environment
   - 🧪 DEVELOPMENT - for development environment

3. **Safety Checks**: 
   - Tiers cannot be enabled in PRODUCTION
   - Clear warnings when in DEVELOPMENT mode
   - Different collection names prevent cross-contamination

## Configuration

### Environment Variables
Set `ENVIRONMENT_NAME=DEVELOPMENT` to use development environment.

### Feature Flags
In `.env.DEVELOPMENT`:
- `TIER_ENABLED=true` - Enable hierarchical memory tiers
- `CONSOLIDATION_ENABLED=true` - Enable memory consolidation
- `PATTERN_RECOGNITION_ENABLED=true` - Enable pattern recognition
- `CODE_INDEXING_ENABLED=true` - Enable code intelligence features
- `CODE_STREAMING_ENABLED=true` - Enable streaming responses
- `CODE_PATTERN_DETECTION=true` - Enable code pattern analysis

## Migration Path

When features are ready for production:
1. Test thoroughly in DEVELOPMENT
2. Export successful configurations
3. Update `.env.PRODUCTION` gradually
4. Use feature flags for controlled rollout

## Important Notes

- **Current Session**: This documentation session is being stored in PRODUCTION
- **Testing**: All hierarchical memory testing happens in DEVELOPMENT
- **No Risk**: Changes in DEVELOPMENT cannot affect PRODUCTION data
- **Clear Separation**: Always know which environment you're in

## Next Steps

1. Start development environment
2. Implement hierarchical memory tiers
3. Test thoroughly without fear
4. Migrate to production when ready