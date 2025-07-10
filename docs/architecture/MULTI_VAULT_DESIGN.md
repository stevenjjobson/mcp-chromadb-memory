# Multi-Vault Architecture Design

## Executive Summary

This document outlines the architecture for supporting multiple vaults in the MCP ChromaDB Memory platform, enabling users to maintain a persistent core knowledge vault alongside project-specific vaults. This design allows developers to accumulate cross-project wisdom while maintaining project isolation.

## Problem Statement

Current limitations:
- Single vault architecture limits multi-project workflows
- No persistence of learnings across projects
- Switching projects loses all context
- Repeated problem-solving across similar projects
- No way to build a personal knowledge base

## Solution Overview

Implement a dual-vault architecture with:
1. **Core Knowledge Vault**: User's persistent personal knowledge base
2. **Project Vaults**: Project-specific context and information
3. **Intelligent Routing**: Automatic categorization of memories
4. **Cross-Vault Search**: Unified search across both vaults
5. **Vault Context Management**: Clear separation with optional bridging

## Architecture Design

### 1. Vault Hierarchy

```
┌─────────────────────────────────────────────────┐
│             MCP Memory Platform                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────┐    ┌──────────────────┐  │
│  │  Core Knowledge  │    │  Project Vault    │  │
│  │     Vault       │    │    (Active)       │  │
│  ├─────────────────┤    ├──────────────────┤  │
│  │ • Patterns      │    │ • Project Docs    │  │
│  │ • Best Practices│    │ • Decisions       │  │
│  │ • Preferences   │    │ • Code Context    │  │
│  │ • Cross-Project │    │ • Session Logs    │  │
│  │   Learnings     │    │ • Local Config    │  │
│  └─────────────────┘    └──────────────────┘  │
│           │                      │              │
│           └──────────┬───────────┘              │
│                      │                          │
│              ┌───────▼────────┐                │
│              │ Unified Search │                │
│              │    Engine      │                │
│              └────────────────┘                │
└─────────────────────────────────────────────────┘
```

### 2. Component Architecture

#### 2.1 Enhanced VaultManager

```typescript
interface VaultContext {
  coreVault: VaultInfo;
  projectVault: VaultInfo;
  mode: 'single' | 'dual' | 'multi';
  searchStrategy: SearchStrategy;
}

interface VaultInfo {
  id: string;
  name: string;
  path: string;
  dockerPath: string;
  type: 'core' | 'project' | 'team';
  isActive: boolean;
  metadata: VaultMetadata;
}

interface SearchStrategy {
  defaultVaults: ('core' | 'project')[];
  weights: { core: number; project: number };
  fallbackBehavior: 'none' | 'expand' | 'suggest';
}
```

#### 2.2 Memory Metadata Enhancement

```typescript
interface EnhancedMemoryMetadata {
  // Existing fields
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    // New vault-specific fields
    vaultId: string;
    vaultType: 'core' | 'project';
    scope: 'personal' | 'project-specific' | 'universal';
    transferable: boolean;
    crossReferences?: {
      vaultId: string;
      memoryId: string;
    }[];
    // Existing fields
    timestamp: string;
    importance: number;
    tags: string[];
  };
}
```

#### 2.3 Router Service

```typescript
interface MemoryRouter {
  categorize(content: string, context: RouterContext): VaultTarget;
  suggestPromotion(memory: Memory): PromotionSuggestion;
  routeQuery(query: string): VaultSearchStrategy;
}

interface RouterContext {
  currentFile?: string;
  recentActivity?: Activity[];
  explicitTarget?: 'core' | 'project';
  userPreference?: RoutingPreference;
}

interface VaultTarget {
  vault: 'core' | 'project';
  confidence: number;
  reasoning: string;
  alternativeSuggestion?: VaultTarget;
}
```

### 3. Data Flow

#### 3.1 Memory Storage Flow

```
User Input → Memory Router → Categorization
                ↓
         [Project-Specific?]
         ↙              ↘
    Project Vault    Core Vault
         ↓                ↓
    Project Index    Core Index
         ↘              ↙
          Unified Search
```

#### 3.2 Search Flow

```
Search Query → Query Analyzer → Search Strategy
                                      ↓
                            [Parallel Search]
                            ↙              ↘
                    Project Search    Core Search
                            ↘              ↙
                             Result Merger
                                   ↓
                            Ranked Results
```

### 4. Implementation Details

#### 4.1 Database Schema Updates

```sql
-- Add vault tracking to memories
ALTER TABLE memories ADD COLUMN vault_id VARCHAR(255);
ALTER TABLE memories ADD COLUMN vault_type VARCHAR(50);
ALTER TABLE memories ADD COLUMN scope VARCHAR(50);
ALTER TABLE memories ADD COLUMN transferable BOOLEAN DEFAULT false;

-- Create vault registry
CREATE TABLE vault_registry (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  path TEXT NOT NULL,
  docker_path TEXT,
  is_active BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cross-references table
CREATE TABLE memory_cross_references (
  id SERIAL PRIMARY KEY,
  source_memory_id VARCHAR(255),
  source_vault_id VARCHAR(255),
  target_memory_id VARCHAR(255),
  target_vault_id VARCHAR(255),
  reference_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.2 Configuration Updates

```env
# Vault Configuration
VAULT_MODE=dual                    # single, dual, or multi
CORE_VAULT_PATH=/core-vault       # Inside Docker
PROJECT_VAULT_PATH=/project-vault  # Inside Docker
DEFAULT_VAULT_CONTEXT=project      # Where to store by default
ENABLE_CROSS_VAULT_SEARCH=true    # Search both vaults
VAULT_SEARCH_STRATEGY=weighted     # weighted, sequential, or parallel

# Search Weights
CORE_VAULT_WEIGHT=0.3             # 30% weight for core results
PROJECT_VAULT_WEIGHT=0.7          # 70% weight for project results

# Auto-Categorization
ENABLE_AUTO_CATEGORIZATION=true   # Auto-route memories
CATEGORIZATION_CONFIDENCE=0.8     # Minimum confidence for auto-routing
PROMOTION_THRESHOLD=3             # Times accessed before promotion suggestion
```

#### 4.3 Docker Volume Configuration

```yaml
services:
  mcp-memory:
    volumes:
      # Core vault - User's personal knowledge base
      - "${CORE_VAULT_HOST_PATH}:/core-vault:rw"
      # Project vault - Current project context
      - "${PROJECT_VAULT_HOST_PATH}:/project-vault:rw"
    environment:
      - VAULT_MODE=dual
      - CORE_VAULT_PATH=/core-vault
      - PROJECT_VAULT_PATH=/project-vault
```

### 5. Tool Enhancements

#### 5.1 Updated Memory Tools

```typescript
// Enhanced store_memory
interface StoreMemoryParams {
  content: string;
  metadata?: Record<string, any>;
  vault?: 'core' | 'project' | 'auto';  // New parameter
  scope?: 'personal' | 'project-specific' | 'universal';
}

// Enhanced recall_memories
interface RecallMemoriesParams {
  query: string;
  vaults?: ('core' | 'project')[];  // Search specific vaults
  strategy?: 'weighted' | 'sequential' | 'isolated';
  limit?: number;
}
```

#### 5.2 New Vault-Specific Tools

```typescript
// Switch active project vault
interface SwitchProjectVaultParams {
  projectPath: string;
  projectName?: string;
  preserveContext?: boolean;
}

// Promote memory to core vault
interface PromoteToCoreParams {
  memoryId: string;
  reason?: string;
  includeRelated?: boolean;
}

// Search across projects
interface CrossProjectSearchParams {
  query: string;
  projectFilter?: string[];
  timeRange?: DateRange;
}
```

### 6. User Experience

#### 6.1 Memory Source Indicators

```
🧠 [Core]: Your preferred testing pattern is pytest with fixtures
🏗️ [Project]: This project uses Jest for testing
📍 [Merged]: Consider using Jest with fixture-like setup functions
```

#### 6.2 Intelligent Suggestions

```
System: "This authentication pattern worked well. Would you like to save it to your core knowledge for future projects?"

Options: 
- Save to Core (available across all projects)
- Keep Project-Specific
- Save to Both with Context
```

#### 6.3 Context Switching

```
Command: "Switch to my e-commerce project"

System Response:
✅ Switched to E-commerce Project
📁 Project Vault: ~/projects/ecommerce/vault
🧠 Core Vault: Still accessible
📊 Found 47 relevant memories from this project
💡 Your last session was 3 days ago working on payment integration
```

### 7. Migration Strategy

#### 7.1 Existing Users

1. Current vault becomes the project vault
2. Create empty core vault
3. Suggest high-value memories for promotion
4. Gradual migration through usage

#### 7.2 Backward Compatibility

- Single vault mode remains default
- Dual vault activated via configuration
- All existing tools continue to work
- New parameters are optional

### 8. Performance Considerations

#### 8.1 Search Optimization

- Parallel search execution
- Result caching per vault
- Lazy loading of vault contents
- Index optimization for cross-vault queries

#### 8.2 Memory Limits

```typescript
interface VaultLimits {
  core: {
    maxMemories: 100000,
    maxSizeMB: 1000,
    compressionEnabled: true
  },
  project: {
    maxMemories: 50000,
    maxSizeMB: 500,
    compressionEnabled: false
  }
}
```

### 9. Security & Privacy

#### 9.1 Vault Isolation

- Separate ChromaDB collections per vault
- Independent access controls
- No automatic cross-vault references
- Explicit user consent for promotion

#### 9.2 Sensitive Data Handling

```typescript
interface VaultSecurity {
  encryption: boolean;
  accessControl: 'none' | 'basic' | 'advanced';
  sensitiveDataPatterns: RegExp[];
  auditLogging: boolean;
}
```

### 10. Future Enhancements

1. **Team Vaults**: Shared knowledge bases for teams
2. **Vault Sync**: Cloud synchronization for core vault
3. **Smart Promotion**: ML-based promotion suggestions
4. **Vault Analytics**: Insights on knowledge growth
5. **Template Vaults**: Pre-populated domain expertise

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [x] Fix configuration issues
- [ ] Create architectural documentation
- [ ] Update VaultManager for dual support
- [ ] Implement basic routing logic

### Phase 2: Core Features (Week 2)
- [ ] Implement cross-vault search
- [ ] Add vault-aware tools
- [ ] Create promotion system
- [ ] Update UI indicators

### Phase 3: Intelligence (Week 3)
- [ ] Implement auto-categorization
- [ ] Add smart routing
- [ ] Create analytics
- [ ] Optimize performance

### Phase 4: Polish (Week 4)
- [ ] Comprehensive testing
- [ ] Migration tools
- [ ] Documentation
- [ ] User guides

## Success Metrics

1. **Adoption**: 80% of users enable dual vault mode
2. **Retention**: 90% continue using after 30 days
3. **Promotion Rate**: Average 5-10 memories promoted per week
4. **Search Performance**: <100ms latency for cross-vault search
5. **User Satisfaction**: 4.5+ rating for multi-project support

## Conclusion

The multi-vault architecture transforms the MCP Memory Platform from a project-specific tool to a career-long AI companion that grows with the developer. By maintaining both personal knowledge and project context, we enable compound learning while preserving project boundaries.