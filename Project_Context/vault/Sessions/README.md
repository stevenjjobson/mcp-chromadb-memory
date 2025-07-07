# Sessions

This folder contains automatically generated session logs from Claude Code development conversations.

## Naming Convention

Files follow the pattern: `YYYY-MM-DD-Project-Name.md`

Example: `2025-01-07-MCP-ChromaDB-Memory.md`

Sessions are organized in year/month folders:
```
Sessions/
└── 2025/
    └── 01/
        └── 2025-01-07-MCP-ChromaDB-Memory.md
```

## Session Structure

Each session includes:

### Metadata
```yaml
date: YYYY-MM-DD
time: HH:MM
project: Project Name
environment: PRODUCTION
tags: [relevant, tags]
tools: [tools, used]
```

### Content Sections
1. **Session Overview** - Date, duration, project context
2. **Summary** - Topics covered, achievements, decisions
3. **Tools Used** - MCP tools utilized during session
4. **Files Changed** - Created and modified files
5. **Code Highlights** - Significant code snippets
6. **Conversation Highlights** - Key exchanges
7. **Lessons Learned** - Insights gained
8. **Next Steps** - Future work identified

## Automatic Generation

Sessions are automatically captured when:
- `AUTO_START_SESSION_LOGGING=true` is configured
- The MCP server connects to Claude Code
- Significant development work occurs

Sessions are automatically saved when:
- The MCP server shuts down gracefully
- A manual save is triggered
- The session reaches a natural conclusion

## Searching Sessions

Use Obsidian's search to find:
- Specific code implementations
- Decisions made about features
- Solutions to past problems
- Tool usage patterns

---
*Sessions are the building blocks of project knowledge*