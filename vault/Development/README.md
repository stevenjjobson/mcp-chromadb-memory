# Development Vault

This folder contains active development work, including implementation summaries, refactoring notes, and development session logs. All development-related documentation should be stored here.

## Structure

```
Development/
├── Sessions/     # Development session logs
└── README.md     # This file
```

## Purpose

- Test new features without affecting production data
- Experiment with hierarchical memory system
- Safe space for breaking changes
- Clear separation from production memories

## Usage

When running the MCP server with `ENVIRONMENT_NAME=DEVELOPMENT`, all Obsidian operations will use this vault instead of the main vault.

## Important

This folder is intentionally kept separate to ensure that experimental development work doesn't contaminate production knowledge.