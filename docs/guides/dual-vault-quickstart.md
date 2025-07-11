# Dual Vault Quick Start Guide

## Overview

The Dual Vault Architecture is a powerful feature that enables you to maintain two separate knowledge bases:

1. **Core Vault**: Your personal "second brain" that persists across all projects
2. **Project Vault**: Project-specific context that switches with your active work

This guide will help you set up and start using dual vaults in under 5 minutes.

## Why Dual Vaults?

### Traditional Approach Problems
- 🔄 **Repeated Learning**: Solving the same problems over and over
- 🤯 **Context Overload**: Single vault becomes cluttered with mixed contexts
- 🔍 **Poor Retrieval**: Hard to find relevant information among unrelated memories
- 🚫 **No Isolation**: Client A's code might leak into Client B's context

### Dual Vault Solution
- 🧠 **Persistent Wisdom**: Core vault accumulates knowledge from every project
- 📦 **Clean Isolation**: Each project has its own dedicated vault
- ⚡ **Instant Switching**: Change projects and context switches automatically
- 🎯 **Better Relevance**: Searches return both universal and project-specific results

## Quick Setup (3 Steps)

### Step 1: Configure Environment Variables

Add these to your `.env.PRODUCTION` file:

```env
# Enable Dual Vault Mode
VAULT_MODE=dual

# Core Vault - Your personal knowledge base
CORE_VAULT_PATH=C:/Users/YourName/Obsidian/YourVault

# Project Vault - This project's specific vault
PROJECT_VAULT_PATH=./vault

# Default context for new memories
DEFAULT_VAULT_CONTEXT=project

# Enable cross-vault search
ENABLE_CROSS_VAULT_SEARCH=true

# Search weighting (30% core, 70% project)
VAULT_SEARCH_STRATEGY=weighted
CORE_VAULT_WEIGHT=0.3
PROJECT_VAULT_WEIGHT=0.7
```

### Step 2: Update Claude Desktop Configuration

Replace your existing MCP server config with the dual vault version:

```json
{
  "mcpServers": {
    "memory": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--name", "claude-mcp-memory",
        "--network", "mcp-chromadb-memory_memory-network",
        "-v", "C:/Users/YourName/Obsidian/YourVault:/core-vault:rw",
        "-v", "C:/path/to/project/vault:/project-vault:rw",
        "-e", "OPENAI_API_KEY=your-api-key",
        "-e", "VAULT_MODE=dual",
        "-e", "CORE_VAULT_PATH=/core-vault",
        "-e", "PROJECT_VAULT_PATH=/project-vault",
        "-e", "ENABLE_CROSS_VAULT_SEARCH=true",
        // ... other environment variables
        "mcp-chromadb-memory-mcp-memory"
      ]
    }
  }
}
```

### Step 3: Restart Services

```bash
# 1. Restart Docker services
docker-compose down
docker-compose up -d chromadb postgres

# 2. Restart Claude Desktop
# Close and reopen Claude Desktop to load new configuration
```

## Using Dual Vaults

### Automatic Categorization

The system intelligently routes memories based on content:

```json
// Automatically goes to CORE vault
{
  "content": "Always use environment variables for configuration",
  "context": "best_practice"
}

// Automatically goes to PROJECT vault
{
  "content": "This project uses PostgreSQL with pgvector",
  "context": "project_specific"
}
```

### Manual Vault Selection

You can explicitly specify which vault to use:

```json
// Force storage in core vault
{
  "tool": "store_memory",
  "arguments": {
    "content": "Python list comprehensions are faster than loops",
    "vault": "core"
  }
}

// Force storage in project vault
{
  "tool": "store_memory",
  "arguments": {
    "content": "Customer prefers blue color scheme",
    "vault": "project"
  }
}
```

### Cross-Vault Search

Search both vaults simultaneously:

```json
{
  "tool": "recall_memories",
  "arguments": {
    "query": "authentication patterns",
    "vault": "both",
    "limit": 10
  }
}
```

Results are weighted according to your configuration (default: 30% core, 70% project).

### Memory Promotion

Promote valuable project insights to your core vault:

```json
{
  "tool": "promote_to_core",
  "arguments": {
    "memoryId": "mem_123456",
    "reason": "Excellent error handling pattern"
  }
}
```

## Vault Statistics

Check the health and contents of both vaults:

```json
{
  "tool": "get_vault_stats"
}
```

Returns:
- Memory count in each vault
- Storage usage
- Most active categories
- Recent activity

## Best Practices

### What Goes in Core Vault?
- 📚 Programming patterns and best practices
- 🛠️ Reusable code snippets
- 💡 Problem-solving approaches
- 🎯 Personal preferences and workflows
- 📖 General technical knowledge

### What Goes in Project Vault?
- 🏗️ Project architecture decisions
- 🔧 Configuration details
- 👥 Client preferences
- 📝 Project-specific documentation
- 🐛 Bug fixes and workarounds

### Search Strategies

1. **Project-First Search** (Default)
   ```json
   {
     "query": "database configuration",
     "vault": "auto"  // Searches both, weights project higher
   }
   ```

2. **Core-Only Search**
   ```json
   {
     "query": "design patterns",
     "vault": "core"  // Only searches core vault
   }
   ```

3. **Balanced Search**
   ```json
   {
     "query": "error handling",
     "vault": "both",
     "weights": { "core": 0.5, "project": 0.5 }
   }
   ```

## Advanced Features

### Memory Categorization Preview

Before storing, preview where a memory would be categorized:

```json
{
  "tool": "categorize_memory",
  "arguments": {
    "content": "Use dependency injection for better testability"
  }
}
// Returns: { "vault": "core", "confidence": 0.92 }
```

### Switching Projects

When switching between projects:

```json
{
  "tool": "switch_project",
  "arguments": {
    "projectPath": "/path/to/new/project/vault"
  }
}
```

This instantly switches your project context while maintaining access to your core vault.

## Troubleshooting

### Common Issues

1. **"Vault not accessible" error**
   - Check vault paths in environment variables
   - Ensure Docker has access to both vault directories
   - Verify folder permissions

2. **Memories going to wrong vault**
   - Check DEFAULT_VAULT_CONTEXT setting
   - Use explicit vault parameter when storing
   - Review categorization patterns

3. **Search not finding expected results**
   - Verify ENABLE_CROSS_VAULT_SEARCH=true
   - Check vault weights configuration
   - Try searching specific vaults

### Verification Commands

```bash
# Check if both vaults are mounted
docker exec claude-mcp-memory ls -la /core-vault
docker exec claude-mcp-memory ls -la /project-vault

# View current configuration
docker exec claude-mcp-memory env | grep VAULT

# Test vault access
curl http://localhost:8000/health
```

## Migration from Single Vault

If you're upgrading from a single vault setup:

1. Your existing vault becomes the project vault
2. Create a new Obsidian vault for core knowledge
3. Use the `promote_to_core` tool to move universal knowledge
4. Gradually build your core vault from new learnings

## Next Steps

- Read the [Dual Vault Architecture Design](../architecture/MULTI_VAULT_DESIGN.md)
- Explore [Memory Categorization Patterns](./memory-categorization.md)
- Set up [Automated Vault Backup](./vault-backup.md)
- Configure [Custom Categorization Rules](./custom-categorization.md)

---

**Quick Reference Card**

| Action | Command | Vault |
|--------|---------|--------|
| Store best practice | `vault: "core"` | Core |
| Store project detail | `vault: "project"` | Project |
| Search everything | `vault: "both"` | Both |
| Auto-categorize | `vault: "auto"` | Intelligent |
| Promote memory | `promote_to_core` | Project → Core |
| Get statistics | `get_vault_stats` | Both |