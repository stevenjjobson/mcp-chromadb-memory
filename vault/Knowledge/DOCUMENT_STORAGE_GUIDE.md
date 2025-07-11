# Document Storage Guide

This guide helps users and Claude understand where to store different types of documents in the Project_Context vault structure.

## Quick Reference

| Document Type | Storage Location | Examples |
|--------------|------------------|----------|
| Development Work | `Development/` | Refactoring summaries, implementation notes |
| Session Logs | `Development/Sessions/` | Daily work logs, conversation summaries |
| System Design | `Architecture/` | Technical specs, system diagrams |
| Technical Decisions | `Architecture/decisions/` | ADRs, design choices |
| How-to Guides | `Knowledge/` | Usage guides, best practices |
| Setup Instructions | `Knowledge/Setup/` | Installation, configuration |
| Future Plans | `Planning/roadmaps/` | Implementation plans, feature roadmaps |
| Market Research | `Planning/market-analysis/` | Competitive analysis, market studies |
| External Docs | `References/` | API docs, third-party guides |
| Code Examples | `References/examples/` | Sample code, responses |
| Old Documents | `Archive/` | Outdated docs, superseded versions |
| Templates | `Templates/` | Reusable document templates |

## Document Categories

### 1. Development (`Development/`)
**Purpose**: Active development work and technical activities

**What goes here:**
- Implementation summaries (like REORGANIZATION_SUMMARY.md)
- Refactoring documentation
- Migration guides
- Technical explorations
- Work-in-progress documentation

**Subdirectories:**
- `Sessions/` - Timestamped development sessions
- `.states/` - Captured working states (auto-generated)
- `.template-cache/` - Template system cache

**Examples:**
- `REORGANIZATION_SUMMARY.md`
- `Migration-to-PostgreSQL.md`
- `Sessions/2025-01-08-Code-Intelligence-Implementation.md`

### 2. Architecture (`Architecture/`)
**Purpose**: System design and technical architecture

**What goes here:**
- System design documents
- Technical specifications
- Architecture diagrams
- Database schemas
- Design patterns

**Subdirectories:**
- `decisions/` - Architecture Decision Records (ADRs)

**Examples:**
- `Platform-Architecture-Overview.md`
- `PostgreSQL-Schema-Design.md`
- `decisions/ADR-003-file-indexing.md`

### 3. Knowledge (`Knowledge/`)
**Purpose**: Accumulated knowledge, guides, and best practices

**What goes here:**
- How-to guides
- Best practices
- Troubleshooting guides
- Learning notes
- Tips and tricks

**Subdirectories:**
- `Setup/` - Installation and configuration guides

**Examples:**
- `DOCUMENT_STORAGE_GUIDE.md` (this file)
- `ChromaDB-Best-Practices.md`
- `Setup/WSL_STARTUP_GUIDE.md`

### 4. Planning (`Planning/`)
**Purpose**: Future plans, roadmaps, and strategic documents

**What goes here:**
- Implementation roadmaps
- Feature planning
- Market analysis
- Competitive research
- Strategic planning

**Subdirectories:**
- `roadmaps/` - Development roadmaps
- `market-analysis/` - Market research
- `competitive-analysis/` - Competitor analysis

**Examples:**
- `roadmaps/Implementation-Roadmap.md`
- `market-analysis/AI-Memory-Market.md`
- `competitive-analysis/Competitor-Features.md`

### 5. References (`References/`)
**Purpose**: External documentation and reference materials

**What goes here:**
- API documentation
- External tool guides
- Code examples
- Integration guides
- Third-party documentation

**Subdirectories:**
- `api-docs/` - API references
- `examples/` - Code and response examples
- `external-resources/` - Links and external docs

**Examples:**
- `MCP-Protocol-Reference.md`
- `examples/Webhook-Response-Samples.md`
- `api-docs/ChromaDB-API.md`

### 6. Archive (`Archive/`)
**Purpose**: Historical documents and outdated content

**What goes here:**
- Superseded documents
- Old versions
- Historical records
- Deprecated features

**Organization:**
- Consider year-based subdirectories for large archives
- Prefix with date when archiving: `2025-01-08-Old-Architecture.md`

**Examples:**
- `PROJECT_STATUS-v1.md`
- `2024/Initial-Design.md`

### 7. Sessions (`Sessions/`)
**Purpose**: Real-time session logs (usually auto-generated)

**What goes here:**
- Auto-generated session logs from the session logger
- Manual session summaries

**Note**: This is primarily for the automatic session logging feature

### 8. Templates (`Templates/`)
**Purpose**: Reusable document templates

**What goes here:**
- Document templates
- Code templates
- Standard formats

**Examples:**
- `session-template.md`
- `adr-template.md`
- `feature-spec-template.md`

## Naming Conventions

### General Rules
1. **Use descriptive names**: `PostgreSQL-Migration-Guide.md` not `migration.md`
2. **Use hyphens for spaces**: `Code-Intelligence-Design.md`
3. **Capitalize properly**: Title Case for document names
4. **Add dates when relevant**: `2025-01-08-Session-Summary.md`
5. **Version when needed**: `API-Design-v2.md`

### Special Prefixes
- `ADR-XXX-` - Architecture Decision Records
- `RFC-XXX-` - Request for Comments
- `DRAFT-` - Work in progress documents

### File Extensions
- `.md` - Markdown documents (preferred)
- `.json` - Configuration and data files
- `.yaml`/`.yml` - Configuration files
- `.png`/`.jpg` - Diagrams and images

## Guidelines for Claude

When creating documents:

1. **Analyze the content type** - Is it development work, architecture, knowledge, etc.?
2. **Check existing patterns** - Look for similar documents in the vault
3. **Use appropriate location** - Follow the categories above
4. **Follow naming conventions** - Descriptive names with proper formatting
5. **Consider the audience** - Technical docs vs. guides vs. plans
6. **Add to index if needed** - Update VAULT_INDEX.md for important documents

### Decision Tree for Storage

```
Is it about current development work?
  → Yes: Development/
  → No: Continue...

Is it a technical design or architecture?
  → Yes: Architecture/ (or Architecture/decisions/ for ADRs)
  → No: Continue...

Is it a guide or accumulated knowledge?
  → Yes: Knowledge/ (or Knowledge/Setup/ for setup guides)
  → No: Continue...

Is it about future plans?
  → Yes: Planning/[appropriate subdirectory]
  → No: Continue...

Is it external documentation?
  → Yes: References/
  → No: Continue...

Is it outdated or historical?
  → Yes: Archive/
  → No: Consider creating a new category
```

## Examples

### Example 1: Reorganization Summary
- **Content**: Summary of project file reorganization
- **Type**: Development activity
- **Location**: `Development/REORGANIZATION_SUMMARY.md`

### Example 2: PostgreSQL Performance Guide
- **Content**: Best practices for PostgreSQL optimization
- **Type**: Knowledge/guide
- **Location**: `Knowledge/PostgreSQL-Performance-Guide.md`

### Example 3: Q2 2025 Roadmap
- **Content**: Features planned for Q2 2025
- **Type**: Planning document
- **Location**: `Planning/roadmaps/Q2-2025-Roadmap.md`

### Example 4: Old Memory System Design
- **Content**: Original memory system before hierarchical implementation
- **Type**: Historical/superseded document
- **Location**: `Archive/2024/Original-Memory-System.md`

## Best Practices

1. **Keep related documents together** - Use subdirectories for logical grouping
2. **Update the index** - Keep VAULT_INDEX.md current for important documents
3. **Cross-reference** - Link between related documents
4. **Archive regularly** - Move outdated documents to Archive/
5. **Use templates** - Maintain consistency with document templates
6. **Document decisions** - Use ADRs for significant choices

## Maintenance

- Review and reorganize quarterly
- Archive documents that are >6 months old and no longer relevant
- Update this guide as new categories emerge
- Keep the vault structure flat and simple - avoid deep nesting