# Dual Vault Quick Start Guide

## 🚀 5-Minute Setup

### 1. Fix Your Current Config (Immediate)

The JSON parsing error in your Claude Desktop config is due to unescaped backslashes. The fix has been applied to:
```
%APPDATA%\Claude\claude_desktop_config.json
```

Changed: `C:\Users\Steve\Obsidian\StevesVault` → `C:/Users/Steve/Obsidian/StevesVault`

### 2. Enable Dual Vault Mode

**Option A: Use the prepared config** (Recommended)
```powershell
# Windows PowerShell
copy claude_desktop_config_dual_vault.json $env:APPDATA\Claude\claude_desktop_config.json

# Update the API key in the file
notepad $env:APPDATA\Claude\claude_desktop_config.json
```

**Option B: Manual update**
Add these lines to your existing config's environment variables:
```json
"-e", "VAULT_MODE=dual",
"-e", "CORE_VAULT_PATH=/core-vault",
"-e", "PROJECT_VAULT_PATH=/project-vault",
"-v", "C:/Users/Steve/Obsidian/StevesVault:/core-vault:rw",
"-v", "C:/Users/Steve/Dockers/mcp-chromadb-memory/Project_Context/vault:/project-vault:rw",
```

### 3. Restart Claude Desktop

1. Close Claude Desktop completely (check system tray)
2. Start Claude Desktop again
3. Your memory server now has access to both vaults!

## 🧪 Test Your Setup

### Quick Test Commands

1. **Check vault status**:
   ```
   "Show me my vault configuration and statistics"
   ```

2. **Test core vault storage**:
   ```
   "Store in core vault: I always prefer to use TypeScript over JavaScript"
   ```

3. **Test project vault storage**:
   ```
   "Remember that this project uses PostgreSQL with pgvector"
   ```

4. **Test cross-vault search**:
   ```
   "What are my preferences for programming languages?"
   ```

## 📁 Vault Organization

### Your Core Knowledge Vault Structure
```
C:/Users/Steve/Obsidian/StevesVault/
├── Patterns/          # Your coding patterns
├── Preferences/       # Personal preferences
├── Learnings/         # Lessons from projects
├── Best-Practices/    # Discovered best practices
└── References/        # Quick references
```

### Project Vault Structure
```
Project_Context/vault/
├── Architecture/      # Project architecture decisions
├── Decisions/         # Project-specific choices
├── Sessions/          # Development session logs
└── Context/          # Current working context
```

## 🎯 Usage Patterns

### Auto-Categorization Examples

**Goes to Core Vault**:
- "I always use feature flags for gradual rollouts"
- "My preferred testing framework is pytest"
- "Best practice: validate at system boundaries"

**Goes to Project Vault**:
- "This project uses Next.js 14"
- "We decided to use Stripe for payments"
- "The API endpoint is https://api.example.com"

### Manual Targeting

Be explicit when needed:
```
"Store in core: [your knowledge]"
"Store in project: [project-specific info]"
```

## 🔧 Troubleshooting

### "Cannot find vault" Error
- Check paths in your config use forward slashes
- Ensure both directories exist
- Verify Docker Desktop is running

### "Wrong vault" for storage
- Check the auto-categorization confidence
- Use explicit targeting if needed
- Adjust weights in config if patterns are off

## 📈 Next Steps

1. **Build your core vault**: Start adding your patterns
2. **Use promotion**: When you solve something clever, promote it to core
3. **Switch projects**: Your core knowledge travels with you

## 🆘 Need Help?

- Full guide: `docs/guides/DUAL_VAULT_MIGRATION_GUIDE.md`
- Architecture: `docs/architecture/MULTI_VAULT_DESIGN.md`
- Check logs: `Project_Context/logs/`

Welcome to intelligent multi-project memory management! 🎉