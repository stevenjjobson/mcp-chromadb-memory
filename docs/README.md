# MCP ChromaDB Memory Server Documentation

Welcome to the documentation for the Cognitive State Management Platform. This documentation is organized to help you quickly find what you need.

## 📚 Documentation Structure

### Getting Started
- **[Dual Vault Quick Start](./guides/dual-vault-quickstart.md)** - Get up and running with dual vault architecture
- **[MCP Configuration Guide](./guides/mcp-configuration-guide.md)** - Configure for Claude Desktop and Claude Code
- **[Claude Desktop Config](./guides/claude-desktop-config.md)** - Detailed Claude Desktop setup
- **[Claude Code vs Desktop](./guides/claude-code-vs-desktop-config.md)** - Understanding the differences
- **[PostgreSQL Setup](./guides/postgresql-setup.md)** - Database configuration

### Guides
- **[Memory Usage Guide](./guides/memory-usage.md)** - Effectively use the memory system
- **[Code Intelligence Guide](./guides/code-intelligence.md)** - Code-aware features and tools
- **[File Search Guide](./guides/file-search.md)** - Fast file and folder searching
- **[Hybrid Storage Guide](./guides/hybrid-storage.md)** - PostgreSQL + ChromaDB architecture
- **[Hook Scripts Guide](./guides/hook-scripts.md)** - Smart tool optimization with 94% token reduction
- **[Hooks Setup](./guides/hooks-setup.md)** - Configure Claude Code hooks
- **[Docker Troubleshooting](./guides/docker-mcp-troubleshooting.md)** - Common Docker issues
- **[Dual Vault Migration](./guides/DUAL_VAULT_MIGRATION_GUIDE.md)** - Migrate to dual vault architecture

### [Architecture](./architecture/)
- **[Platform Overview](./architecture/platform-overview.md)** - High-level system design
- **[System Design](./architecture/system-design.md)** - Technical architecture details
- **[Database Schema](./architecture/database-schema.md)** - PostgreSQL and ChromaDB schemas
- **[Migration Strategy](./architecture/migration-strategy.md)** - Data migration approaches
- **[ChromaDB API Note](./architecture/chromadb-api-note.md)** - API considerations

### [Roadmap](./roadmap/)
- **[Current Status](./roadmap/current-status.md)** - Development progress tracker
- **[Implementation Phases](./roadmap/implementation-phases.md)** - Detailed phase breakdown
- **[Future Vision](./roadmap/future-vision.md)** - Long-term platform goals

### [API Reference](./api/)
- **[Tools Reference](./api/tools-reference.md)** - Complete MCP tools documentation

## 🗂️ Vault Documentation

The `vault/` folder serves as an Obsidian vault containing:
- **Architecture** - System design and technical decisions
- **Development** - Implementation details and session logs
- **Knowledge** - Guides and best practices
- **Planning** - Roadmaps and future plans
- **References** - External documentation and APIs
- **Templates** - Reusable document templates
- **Archive** - Historical documents

See [Vault Index](../vault/VAULT_INDEX.md) for detailed vault contents.

## 🧪 Testing

Test files are organized in the `tests/` directory:
- `unit/` - Unit tests
- `integration/` - Integration tests by component
- `performance/` - Performance benchmarks
- `examples/` - Example usage scripts

## 🛠️ Scripts

Utility scripts are organized in `scripts/`:
- `setup/` - Installation and configuration
- `operations/` - Backup, migration, maintenance
- `monitoring/` - Health checks and dashboards
- `environment/` - Environment management
- `utilities/` - Helper scripts

## 📦 Source Code

The platform implementation is in `src/`:
- Core memory management
- Database repositories
- MCP tools implementation
- Service layer
- Type definitions

## 🎯 Specialized Implementations

### CoachNTT
A conversational AI implementation with voice capabilities:
- [CoachNTT Overview](../CoachNTT/README.md)
- [Implementation Guide](../CoachNTT/IMPLEMENTATION_GUIDE.md)
- [Implementation Summary](../CoachNTT/IMPLEMENTATION_SUMMARY.md)

## 📦 Archive

Historical documentation and deprecated guides are stored in [docs/archive/](./archive/).

## 🚀 Quick Links

- [Platform Vision](../vault/Architecture/Platform%20Approach%20-%20Cognitive%20State%20Management.md)
- [Implementation Roadmap](../vault/Planning/roadmaps/Implementation%20Roadmap.md)
- [Development Status](./roadmap/current-status.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Main Project README](../README.md)