# MCP ChromaDB Memory Project Vault

Welcome to the project knowledge base for the MCP ChromaDB Memory Server. This vault contains all project-related documentation, decisions, patterns, and development sessions.

## 📁 Vault Structure

### 📝 [[Sessions]]
Development session logs automatically captured from Claude Code conversations. Each session includes:
- Summary of work completed
- Decisions made
- Code snippets created
- Tools used
- Files modified

### 🏗️ [[Architecture]]
Architectural decisions, design patterns, and system diagrams.

#### 📋 [[Architecture/decisions|Decisions]]
Architecture Decision Records (ADRs) documenting why specific choices were made.

#### 🎨 [[Architecture/patterns|Patterns]]
Proven design patterns and implementation strategies discovered during development.

#### 📊 [[Architecture/diagrams|Diagrams]]
System architecture diagrams, data flow charts, and component relationships.

### 🧠 [[Knowledge]]
Accumulated project knowledge and learnings.

#### 💡 [[Knowledge/solutions|Solutions]]
Problem-solution pairs discovered during development.

#### 📜 [[Knowledge/snippets|Code Snippets]]
Reusable code fragments and implementation examples.

#### ⚠️ [[Knowledge/gotchas|Gotchas]]
Known issues, workarounds, and things to watch out for.

### 🚀 [[Implementation]]
Track implementation progress and planning.

#### ✅ [[Implementation/completed|Completed]]
Features and tasks that have been successfully implemented.

#### 🔄 [[Implementation/in-progress|In Progress]]
Currently active development work.

#### 📅 [[Implementation/planned|Planned]]
Upcoming features and enhancements.

### 📄 [[Templates]]
Reusable templates for consistent documentation.

## 🔍 Quick Links

### Recent Sessions
```dataview
TABLE date, summary
FROM "Sessions"
SORT date DESC
LIMIT 5
```

### Recent Decisions
```dataview
TABLE date, status, impact
FROM "Architecture/decisions"
SORT date DESC
LIMIT 5
```

### Open Tasks
```dataview
TABLE priority, assigned, due
FROM "Implementation/in-progress"
WHERE status != "completed"
SORT priority DESC
```

## 🏷️ Tags

- `#session` - Development session logs
- `#decision` - Architectural decisions
- `#pattern` - Design patterns
- `#solution` - Problem solutions
- `#snippet` - Code examples
- `#gotcha` - Known issues
- `#todo` - Pending tasks
- `#completed` - Finished work

## 📊 Vault Statistics

- Total Sessions: `$= dv.pages('"Sessions"').length`
- Total Decisions: `$= dv.pages('"Architecture/decisions"').length`
- Code Snippets: `$= dv.pages('"Knowledge/snippets"').length`
- Active Tasks: `$= dv.pages('"Implementation/in-progress"').where(p => p.status != "completed").length`

## 🚀 Getting Started

1. **Browse Sessions**: Check the [[Sessions]] folder to see development history
2. **Review Architecture**: Understand design decisions in [[Architecture/decisions]]
3. **Find Solutions**: Search [[Knowledge/solutions]] for previously solved problems
4. **Track Progress**: Monitor implementation status in [[Implementation]]

## 🔄 Vault Maintenance

This vault is automatically maintained by the MCP ChromaDB Memory Server:
- Sessions are auto-captured from Claude Code
- Memories are indexed for semantic search
- Patterns are extracted from successful implementations
- Documentation is generated from actual work

---
*This is a living document that grows with the project*
*Last Updated: 2025-01-05*