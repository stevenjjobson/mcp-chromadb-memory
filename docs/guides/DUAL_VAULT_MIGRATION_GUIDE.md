# Dual Vault Migration Guide

## Overview

This guide helps you migrate from a single-vault setup to the powerful dual-vault architecture that separates your core knowledge from project-specific information.

## What's Changing

### Before: Single Vault
- All memories stored in one vault
- Switching projects means losing context
- No persistence of learnings across projects

### After: Dual Vault
- **Core Knowledge Vault**: Your personal, persistent knowledge base
- **Project Vaults**: Project-specific information that switches with your work
- Both vaults accessible simultaneously

## Migration Steps

### Step 1: Update Your Configuration

#### For Claude Desktop

1. **Backup your current config**:
   ```bash
   cp %APPDATA%\Claude\claude_desktop_config.json %APPDATA%\Claude\claude_desktop_config.backup.json
   ```

2. **Use the new dual vault config**:
   ```bash
   cp claude_desktop_config_dual_vault.json %APPDATA%\Claude\claude_desktop_config.json
   ```

3. **Update with your details**:
   - Replace `YOUR_OPENAI_API_KEY_HERE` with your actual key
   - Adjust the core vault path to your personal Obsidian vault
   - Ensure project vault path points to your project

#### For Claude Code CLI

1. **Update environment variables**:
   ```bash
   export VAULT_MODE=dual
   export CORE_VAULT_PATH=/path/to/your/personal/vault
   export PROJECT_VAULT_PATH=./Project_Context/vault
   ```

2. **Or use the new .env file**:
   ```bash
   cp .env.DUAL_VAULT .env.PRODUCTION
   ```

### Step 2: Initialize Your Core Vault

If you don't have a personal knowledge vault yet:

1. **Create a new Obsidian vault** for your core knowledge
2. **Create initial structure**:
   ```
   Core Knowledge Vault/
   ├── Patterns/
   │   ├── Authentication/
   │   ├── Testing/
   │   └── Architecture/
   ├── Preferences/
   │   ├── Tools.md
   │   └── Workflows.md
   ├── Learnings/
   │   └── Project-Lessons/
   └── References/
       └── Best-Practices/
   ```

### Step 3: Migrate Existing Memories

The system provides tools to help identify and migrate valuable memories from your project vault to your core vault:

1. **Identify candidates for promotion**:
   ```
   "Show me memories that would be valuable across projects"
   ```

2. **Review and promote**:
   ```
   "Promote this memory about authentication patterns to my core vault"
   ```

3. **Batch migration** (for specific topics):
   ```
   "Find all memories about testing strategies and suggest which should be in core vault"
   ```

### Step 4: Update Your Workflow

#### Storing Memories

The system will auto-categorize, but you can be explicit:

```
// Auto-categorization
"Remember that this project uses PostgreSQL"
→ Automatically stored in project vault

"I always prefer to use environment variables for config"
→ Automatically stored in core vault

// Explicit targeting
"Store in core vault: Always validate input at the boundary"
"Store in project: The API key for this service is XYZ"
```

#### Searching Memories

By default, both vaults are searched:

```
"How do I implement authentication?"
→ Searches both vaults, shows results with indicators:
   🧠 [Core]: JWT with refresh tokens
   🏗️ [Project]: Using Auth0 in this project
```

Search specific vaults:
```
"Search my core knowledge for testing patterns"
"What does this project say about deployment?"
```

### Step 5: Test Your Setup

1. **Verify both vaults are accessible**:
   ```
   "Show me my vault statistics"
   ```

2. **Test memory storage**:
   ```
   "Test core vault: I prefer dark mode"
   "Test project vault: This project uses Node 18"
   ```

3. **Test cross-vault search**:
   ```
   "Search both vaults for 'configuration'"
   ```

## Best Practices

### What Goes in Core Vault

✅ **Good for Core**:
- Programming patterns and principles
- Personal preferences and workflows  
- Lessons learned from projects
- Best practices you've discovered
- Tool configurations you always use
- Problem-solving approaches

❌ **Not for Core**:
- Project-specific credentials
- Client-specific information
- Local environment details
- Temporary decisions
- Project-specific code

### What Stays in Project Vault

✅ **Good for Project**:
- Project architecture decisions
- Local configuration details
- API endpoints and keys
- Database schemas
- Meeting notes
- Project-specific patterns

### Memory Examples

**Core Vault Memory**:
```markdown
---
vault: core
tags: [testing, best-practice]
---

Always structure tests with Arrange-Act-Assert pattern:
- Arrange: Set up test data
- Act: Execute the function
- Assert: Verify the results

This makes tests readable and maintainable.
```

**Project Vault Memory**:
```markdown
---
vault: project  
tags: [architecture, decision]
---

We're using microservices with:
- API Gateway: Kong
- Service Mesh: Istio
- Message Queue: RabbitMQ

This decision was made for scalability.
```

## Troubleshooting

### Issue: "Core vault not found"
**Solution**: Ensure CORE_VAULT_PATH is set correctly and the directory exists

### Issue: "Memories going to wrong vault"
**Solution**: 
- Check auto-categorization confidence with verbose logging
- Use explicit vault targeting if needed
- Adjust categorization patterns in config

### Issue: "Can't search across vaults"
**Solution**: 
- Ensure ENABLE_CROSS_VAULT_SEARCH=true
- Check both vaults are properly initialized
- Verify search strategy is set to 'weighted' or 'parallel'

## Advanced Configuration

### Customizing Auto-Categorization

Edit categorization patterns in the config:

```env
# Custom patterns for your workflow
CORE_PATTERNS="always,prefer,my style,best practice,learned"
PROJECT_PATTERNS="this project,decided,configured,using here"
```

### Adjusting Search Weights

Control how results are ranked:

```env
CORE_VAULT_WEIGHT=0.3    # 30% weight to core results
PROJECT_VAULT_WEIGHT=0.7  # 70% weight to project results
```

### Setting Promotion Thresholds

Automatically suggest promotion after repeated access:

```env
PROMOTION_THRESHOLD=3  # Suggest after 3 accesses
PROMOTION_WINDOW=7     # Within 7 days
```

## Next Steps

1. **Build your core knowledge**: Start adding your patterns and preferences
2. **Use promotion actively**: When you solve something clever, promote it
3. **Review quarterly**: Look at your core vault growth
4. **Share learnings**: Export core patterns for team sharing

## Support

If you encounter issues:
1. Check the logs in `Project_Context/logs/`
2. Run health check: "Check vault system health"
3. See troubleshooting in main documentation

Welcome to a more intelligent way of preserving your development knowledge!