# Obsidian Integration Guide

This guide explains how to use the Obsidian vault integration features in the MCP ChromaDB Memory Server.

## Overview

The MCP ChromaDB Memory Server now includes full integration with Obsidian vaults, allowing Claude to:
- Read notes from your Obsidian vault
- Search across all notes using semantic search
- Create and update notes with proper frontmatter
- Track note relationships and backlinks
- Store important notes as AI memories

## Configuration

### 1. Set Your Vault Path

The server needs to know where your Obsidian vault is located. This is configured through:

**For Docker (Recommended)**:
- The vault is mounted as `/vault` inside the container
- Set `OBSIDIAN_VAULT_PATH=/vault` in the environment

**For Local Development**:
- Set `OBSIDIAN_VAULT_PATH=C:/Users/Steve/Obsidian/StevesVault` in your .env file

### 2. Docker Configuration

The docker-compose.yml already includes the vault mount:
```yaml
volumes:
  - C:/Users/Steve/Obsidian/StevesVault:/vault:ro
```

The `:ro` makes it read-only by default. Remove this if you want Claude to write notes.

### 3. Claude Desktop Configuration

Your Claude Desktop config already includes the necessary volume mount:
```json
"-v", "C:\\Users\\Steve\\Obsidian\\StevesVault:/vault:ro",
"-e", "OBSIDIAN_VAULT_PATH=/vault"
```

## Available Tools

### 1. read_obsidian_note
Read a specific note from your vault.
```
Example: "Read my note at 'Daily Notes/2024-01-01.md'"
```

### 2. list_obsidian_notes
List all notes in your vault or a specific folder.
```
Example: "List all notes in my Daily Notes folder"
```

### 3. search_obsidian_vault
Search across all notes using semantic search powered by AI embeddings.
```
Example: "Search for notes about project planning"
```
**Note**: This requires notes to be indexed first. Use `index_obsidian_vault` if search returns no results.

### 4. write_obsidian_note
Create or update notes with proper frontmatter.
```
Example: "Create a new note in Projects/NewIdea.md about AI memory systems"
```

### 5. get_obsidian_backlinks
Find all notes that link to a specific note.
```
Example: "What notes link to my 'Project Overview' note?"
```

### 6. index_obsidian_vault
Index your vault for fast semantic search. Supports incremental updates.
```
Example: "Index my entire Obsidian vault"
Example: "Do a dry run to see how much it would cost to index my vault"
Example: "Index only my Projects and Research folders"
```

### 7. get_obsidian_index_status
Check the current status of your vault index.
```
Example: "What's the status of my Obsidian index?"
```

### 8. clear_obsidian_index
Clear all indexed notes (useful for troubleshooting).
```
Example: "Clear my Obsidian index (confirm: true)"
```

## Usage Examples

### Reading Notes
```
"Can you read my daily note from today?"
"Show me the content of 'Projects/AI Memory/Overview.md'"
```

### Searching Your Vault
```
"Search my vault for information about machine learning"
"Find notes that mention ChromaDB"
```

### Creating Notes
```
"Create a new note in 'Ideas/AI-Integration.md' about using Claude with Obsidian"
"Update my 'Projects/Status.md' note with the latest progress"
```

### Exploring Connections
```
"What notes link to my 'Main Index' note?"
"Show me all notes in my 'Research' folder"
```

## Memory Integration

When you store memories using the memory server, you can use the `obsidian_note` context:
```
"Remember that my project notes are in 'Projects/Current/AI-Memory.md' [context: obsidian_note]"
```

This gives the memory a higher importance score and helps Claude understand it's related to your Obsidian vault.

## Security Notes

1. **Read-Only by Default**: The vault is mounted read-only to prevent accidental changes
2. **Path Restrictions**: The server can only access files within your specified vault
3. **File Types**: Only `.md` files are processed; other files are ignored
4. **No Hidden Folders**: Folders starting with `.` are skipped (like `.obsidian`)

## Troubleshooting

### "Obsidian vault not configured"
- Ensure `OBSIDIAN_VAULT_PATH` is set in your environment or .env file
- Verify the vault path exists and is accessible

### "Note not found"
- Check the note path is relative to your vault root
- Use forward slashes even on Windows: `Daily Notes/2024-01-01.md`
- Ensure the file has a `.md` extension

### Search not finding notes
- The first search might be slow as notes are indexed
- Ensure ChromaDB is running and healthy
- Check that your OpenAI API key is valid for embeddings

### Permission errors
- Remove `:ro` from volume mounts if you need write access
- Ensure the vault directory has proper read permissions

## Best Practices

1. **Organize with Folders**: Use a clear folder structure for easier navigation
2. **Use Frontmatter**: Add metadata to your notes for better organization
3. **Tag Consistently**: Use consistent tags across your vault
4. **Regular Backups**: Always backup your vault before enabling write access
5. **Memory Context**: Use `obsidian_note` context when storing vault-related memories

## Vault Indexing

### Why Index Your Vault?

Indexing your Obsidian vault enables:
- **Fast semantic search** across all notes
- **No file system access** during searches (faster)
- **AI-powered similarity** finding related notes
- **Incremental updates** only re-index changed notes

### Cost Estimation

The indexing process uses OpenAI's embedding API:
- **Cost**: ~$0.00002 per 1,000 tokens
- **Average note**: ~500 words ≈ 750 tokens
- **Example**: 1,000 notes ≈ $0.40 total

### Indexing Strategies

#### 1. Full Vault Index
```
"Index my entire Obsidian vault"
```

#### 2. Dry Run First
```
"Do a dry run to see how much it would cost to index my vault"
```

#### 3. Selective Indexing
```
"Index only my Projects and Research folders"
"Index only notes tagged with #important"
```

#### 4. Incremental Updates
```
"Index my vault" (will skip unchanged notes automatically)
"Force reindex all notes" (use forceReindex: true)
```

### Managing Your Index

- **Check status**: "What's the status of my Obsidian index?"
- **Clear index**: "Clear my Obsidian index (confirm: true)"
- **Refresh**: Just run index again - it's incremental!

### Performance Tips

1. **Initial indexing**: May take several minutes for large vaults
2. **Rate limiting**: Automatic delays prevent API throttling
3. **Progress tracking**: Watch the console for progress updates
4. **Folder filtering**: Index only what you need to search

## Advanced Features (Coming Soon)

- [ ] Auto-import important notes as memories
- [ ] Watch for vault changes and update memories
- [ ] Sync Obsidian tags with memory metadata
- [ ] Support for Dataview queries
- [ ] Integration with Obsidian plugins
- [x] Bulk indexing with cost estimation
- [x] Incremental indexing based on file changes
- [x] Selective indexing by folder/tag

## Privacy

Your Obsidian notes are:
- Only accessible within your local Docker container
- Never sent to external services (except OpenAI for embeddings)
- Not stored in ChromaDB unless you explicitly create memories from them
- Processed entirely on your local machine

For questions or issues, please refer to the main README or create an issue on GitHub.