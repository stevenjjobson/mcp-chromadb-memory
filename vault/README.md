# Project_Context - Obsidian Vault & Knowledge Base

## Overview

This directory serves as the **Obsidian vault** for the MCP ChromaDB Memory Server project. It functions as both:

1. **A Knowledge Base** - Storing project documentation, architecture decisions, and accumulated knowledge
2. **An Obsidian Vault** - Integrated with the MCP server for session logging and AI context preservation

## Purpose

Unlike the traditional `docs/` folder (which contains technical documentation for developers), this vault is designed for:

- **AI Context Management** - Providing rich context to AI assistants like Claude
- **Session Logging** - Automatically capturing development sessions and conversations
- **Knowledge Accumulation** - Building a searchable knowledge base over time
- **Template Management** - Reusable templates for consistent documentation
- **State Preservation** - Capturing and restoring development context

## Structure

```
Project_Context/
├── Architecture/          # System design and technical architecture
│   └── decisions/        # Architecture Decision Records (ADRs)
├── Development/          # Active development work
│   └── Sessions/         # Auto-generated session logs
├── Knowledge/            # Guides, best practices, accumulated wisdom
│   └── Setup/           # Installation and configuration guides
├── Planning/             # Future plans and roadmaps
│   ├── roadmaps/        # Implementation roadmaps
│   ├── market-analysis/ # Market research
│   └── competitive-analysis/
├── References/           # External documentation
│   ├── api-docs/        # API references
│   └── examples/        # Code examples
├── Archive/              # Historical/outdated documents
├── Sessions/             # Session logs (auto-generated)
├── Templates/            # Document templates
└── VAULT_INDEX.md        # Auto-generated vault index
```

## Integration with MCP Server

This vault is directly integrated with the MCP server's functionality:

### 1. **Session Logging**
When `AUTO_START_SESSION_LOGGING=true`, the server automatically logs conversations to the `Sessions/` folder.

### 2. **Vault Management**
The MCP server's VaultManager can:
- Switch between multiple vaults
- Backup and restore vault contents
- Track vault metadata

### 3. **Template System**
Templates in the `Templates/` folder can be:
- Applied via MCP tools
- Imported from webhooks
- Used for consistent documentation

### 4. **Memory Integration**
Documents can be stored as memories with:
- Semantic search capabilities
- Importance scoring
- Context preservation

## Usage Guidelines

### For Developers
- Use `docs/` for API documentation and technical guides
- Use this vault for project knowledge and context

### For AI Assistants
- This vault provides rich context about the project
- Session logs help maintain continuity
- Architecture decisions explain the "why" behind implementations

### Document Storage
See [DOCUMENT_STORAGE_GUIDE.md](./Knowledge/DOCUMENT_STORAGE_GUIDE.md) for detailed guidelines on where to store different types of documents.

## Key Files

- **VAULT_INDEX.md** - Auto-generated index with statistics and health status
- **vault-registry.json** - Tracks this vault in the MCP server
- **Sessions/** - Contains timestamped development sessions
- **Templates/** - Reusable document templates

## Best Practices

1. **Keep It Organized** - Follow the folder structure
2. **Use Templates** - Maintain consistency
3. **Archive Regularly** - Move outdated docs to Archive/
4. **Cross-Reference** - Link between related documents
5. **Update the Index** - Keep VAULT_INDEX.md current

## Configuration

This vault is configured in:
- `.env`: `OBSIDIAN_VAULT_PATH=./Project_Context`
- `vault-registry.json`: Tracks vault metadata
- `.mcp.json`: Mounts this directory as `/vault` in Docker

## Note

This is NOT a traditional Obsidian vault with `.obsidian` folder. Instead, it's a structured knowledge base that integrates with Obsidian through the MCP server's ObsidianManager.