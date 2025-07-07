# Memory System Usage Guide

## 🧠 Overview

The MCP ChromaDB Memory System acts as a persistent brain for Claude, automatically storing important information and intelligently retrieving it when needed. This guide explains how to effectively use the memory system during development.

## 📝 How Memories Are Stored

### Automatic Storage
Memories are only stored if they exceed an importance threshold (default: 0.7). The system automatically assesses importance based on:

- **Context Type**:
  - `task_critical`: +0.3 importance
  - `user_preference`: +0.2 importance
  - `obsidian_note`: +0.25 importance
  - `general`: baseline

- **Content Analysis**:
  - Long content (>500 chars): +0.1
  - Contains code/technical terms: +0.15
  - Contains decisions/bugs/errors: +0.2

### Memory Structure
Each memory includes:
- Unique ID: `mem_timestamp_hash`
- Content: The actual information
- Context: Category of the memory
- Importance: Score from 0-1
- Metadata: Additional information
- Access tracking: Count and last accessed time

## 🔍 Memory Retrieval

### Multi-Factor Scoring
The system combines multiple factors to find the most relevant memories:
- **Semantic Similarity** (40%): Content relevance
- **Recency** (30%): Newer memories prioritized
- **Importance** (20%): Critical information first
- **Frequency** (10%): Often-accessed memories

### Search Types

#### 1. Semantic Search (Default)
Best for conceptual queries:
```
"What do you remember about authentication?"
"Recall our discussions about the architecture"
```

#### 2. Exact Search
Best for specific terms:
```
"search_exact: 'hierarchical memory system'"
"search_exact with field 'project': 'MCP ChromaDB'"
```

#### 3. Hybrid Search
Combines both approaches:
```
"search_hybrid: 'tier implementation' with exactWeight 0.6"
```

## 💡 Best Practices

### Starting a Session

1. **Load Previous Context**:
   ```
   "What's our current progress on [project/feature]?"
   "Recall recent work on [topic]"
   "What were our last decisions?"
   ```

2. **Check Active Tasks**:
   ```
   "Show current todo list"
   "What tasks are in progress?"
   ```

3. **Review Recent Changes**:
   ```
   "What files did we modify recently?"
   "Show recent code changes"
   ```

### During Development

1. **Store Important Information**:
   - Prefix decisions with "DECISION:"
   - Mark critical info with "IMPORTANT:" or "NOTE:"
   - State preferences clearly: "I prefer..."
   - Document fixes: "BUG FIXED:" or "RESOLVED:"

2. **Context Management**:
   ```
   "Store context: Starting work on [feature]"
   "Remember: We chose [approach] because [reason]"
   ```

3. **Progress Tracking**:
   ```
   "Store progress: Completed [task], next is [task]"
   "Mark as done: [specific achievement]"
   ```

### Memory Optimization

#### When to Optimize
- After 1000+ memories accumulated
- When queries become slower (>500ms)
- Before major project transitions
- Monthly maintenance

#### Optimization Steps

1. **Analyze Current State**:
   ```
   "analyze_access_patterns"
   "Check memory health"
   "Show memory statistics"
   ```

2. **Identify Issues**:
   ```
   "Find duplicate memories"
   "Show rarely accessed memories (cold tier)"
   "List memories older than 30 days"
   ```

3. **Clean Up**:
   ```
   "Delete memories with access count < 2 older than 14 days"
   "Remove test memories"
   "Clear temporary context memories"
   ```

4. **Consolidate**:
   ```
   "Summarize all [topic] memories into one comprehensive memory"
   "Create consolidated memory of architecture decisions"
   ```

### Token Management

For long conversations or limited context:

1. **Get Compressed Context**:
   ```
   "get_compressed_context about [topic] in 500 tokens"
   ```

2. **Optimize Specific Memories**:
   ```
   "get_optimized_memory [memory_id] in 300 tokens"
   ```

## 🎯 Common Workflows

### Project Startup
```bash
# 1. Load context
"What do you remember about the MCP ChromaDB Memory project?"

# 2. Check progress
"Show current todo list and recent completions"

# 3. Review decisions
"What architectural decisions have we made?"
```

### Feature Development
```bash
# 1. Set context
"Store context: Implementing hierarchical memory system"

# 2. During work
"DECISION: Using three tiers - working, session, long-term"
"NOTE: Tier migration happens every hour"

# 3. Problem solving
"What similar problems have we solved before?"
"Recall any issues with ChromaDB collections"
```

### Debugging Session
```bash
# 1. Store the issue
"BUG: Memory queries returning duplicates when..."

# 2. Track investigation
"Investigated: The issue stems from..."

# 3. Document solution
"FIXED: Resolved by implementing deduplication in..."
```

### End of Session
```bash
# 1. Summarize progress
"What did we accomplish today?"

# 2. Store next steps
"TODO for next session: [tasks]"

# 3. Capture state
"Store current working context"
```

## 🚀 Advanced Features

### Access Pattern Analysis
Monitor memory usage:
```
"analyze_access_patterns"
```

This shows:
- Hot memories (frequently accessed)
- Warm memories (occasionally accessed)
- Cold memories (rarely accessed)
- Recommendations for optimization

### Vault Management
Switch between project contexts:
```
"list_vaults"
"switch_vault [vault_id]"
```

### State Capture
Save complete working state:
```
"capture_state 'Feature X Implementation'"
"list_states"
"restore_state [state_id]"
```

## 🔧 Troubleshooting

### Slow Queries
1. Check memory count: `"get_memory_stats"`
2. Analyze patterns: `"analyze_access_patterns"`
3. Clean cold memories: `"Delete memories with accessCount < 2"`

### Missing Memories
1. Check importance threshold: Memories below 0.7 aren't stored
2. Verify context: `"search_exact in context 'task_critical'"`
3. Check timestamp: `"Recall memories from today"`

### Duplicate Information
1. Find duplicates: `"Find duplicate memories about [topic]"`
2. Consolidate: `"Merge these memories: [id1, id2, id3]"`

## 📊 Memory Health Monitoring

Regular maintenance tasks:

### Weekly
- Review access patterns
- Clean up test/temporary memories
- Consolidate related memories

### Monthly
- Full memory health check
- Remove obsolete memories
- Optimize frequently accessed memories
- Backup important memories

### Per Project
- Capture final state
- Create project summary memory
- Archive to separate vault if needed

## 🎓 Pro Tips

1. **Use Specific Contexts**: Don't rely only on 'general' context
2. **Be Explicit**: Clear statements are easier to recall
3. **Regular Summaries**: Consolidate knowledge periodically
4. **Tag Decisions**: Make them easy to find later
5. **Clean as You Go**: Don't let memories accumulate unnecessarily

Remember: The memory system is designed to enhance your productivity by maintaining context across sessions. Use it actively and it will become more valuable over time!