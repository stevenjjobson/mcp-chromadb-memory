# Architecture

This folder contains architectural documentation for the MCP ChromaDB Memory Server project.

## Structure

### 📋 [decisions/](./decisions)
Architecture Decision Records (ADRs) documenting significant design choices.

### 🎨 [patterns/](./patterns)
Reusable design patterns and architectural strategies.

### 📊 [diagrams/](./diagrams)
Visual representations of system architecture and data flows.

## Key Architectural Principles

1. **Hierarchical Memory Organization**
   - Three-tier system for optimal performance
   - Time-based migration between tiers
   - Automatic consolidation

2. **Project-Integrated Knowledge**
   - Vault lives with code
   - Version controlled documentation
   - Git-aware memory links

3. **Stateful Context Management**
   - Complete context preservation
   - Multi-device synchronization
   - Time-travel capabilities

4. **Intelligent Processing**
   - Automatic session extraction
   - Pattern recognition
   - Importance assessment

## Architecture Evolution

Track how the architecture has evolved:
```dataview
TABLE date, title, status
FROM "Architecture/decisions"
SORT date ASC
```

---
*Architecture is not just about technology, but about capturing the "why" behind our choices*