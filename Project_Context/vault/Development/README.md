# Development Vault

This is the isolated vault for the DEVELOPMENT environment. All sessions, notes, and data created while testing in the development environment will be stored here, completely separate from production data.

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