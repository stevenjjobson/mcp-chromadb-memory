# 🎯 Quick Reference Card - CoachNTT Cognitive Platform

## 🚦 Starting the Platform

### From WSL (Recommended)
```bash
cd /mnt/c/Users/Steve/Dockers/mcp-chromadb-memory
docker-compose up -d coachntt-chromadb coachntt-postgres
claude  # Launches Claude Code with MCP
```

### From Windows PowerShell
```powershell
cd C:\Users\Steve\Dockers\mcp-chromadb-memory
docker-compose up -d coachntt-chromadb coachntt-postgres
```

## 🧠 Essential Memory Commands

| What You Want | What to Say |
|--------------|-------------|
| **Store Info** | "Remember that [information]" |
| **Recall Info** | "What do you remember about [topic]?" |
| **Store Code Pattern** | "Store this pattern: [code/approach]" |
| **Find Code** | "Find all functions that [do something]" |
| **Save State** | "Capture current state as [name]" |
| **Restore State** | "Restore state [name]" |
| **See Stats** | "Show memory statistics" |

## 📁 Key Locations

| What | Where |
|------|-------|
| **Session Logs** | `vault/Sessions/YYYY-MM-DD.md` |
| **Your API Key** | Add to `.env` file |
| **Claude Desktop Config** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Test Scripts** | `test-functionality.ts` |

## 🔧 Troubleshooting

**Check if services are running:**
```bash
docker-compose ps
```

**View logs if something's wrong:**
```bash
docker logs coachntt-postgres
docker logs coachntt-chromadb
```

**PostgreSQL Connection:**
- Database: `coachntt_cognitive_db`
- User: `coachntt_user`
- Password: `coachntt_pass`

## 💡 Power User Tips

1. **Morning Routine**: "Show me yesterday's work summary"
2. **Before Context Switch**: "Capture state as [task-name]"
3. **Finding Code Fast**: "Find symbol HybridMemoryManager"
4. **Debug Memory**: "Store this error: [paste error]"
5. **Review Progress**: "What did we accomplish this week?"

## 🎨 Memory Contexts

- `general` - Default, everyday information
- `user_preference` - Your preferences and patterns
- `task_critical` - Must-remember information
- `code_*` - Code-specific memories (automatic)

## ⚡ Performance Facts

- **Code Search**: 60x faster than ChromaDB alone
- **Symbol Indexing**: 644 symbols/second
- **Memory Queries**: <10ms for working tier
- **Bulk Operations**: <1 second for thousands of items

---

*Keep this card handy for quick reference. The more you use the memory system, the more valuable it becomes!*