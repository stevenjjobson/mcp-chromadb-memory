# Vault Template System

## Overview

The Vault Template System provides a flexible framework for creating, managing, and importing documentation templates. Templates can be imported via webhooks from third-party sources, enabling dynamic content generation and standardization across projects.

## Template Structure

### Core Template Format

Templates use YAML frontmatter with Handlebars-style variables:

```markdown
---
template: true
version: 1.0
name: "Template Name"
description: "What this template is for"
category: "session|decision|pattern|solution|snippet"
variables:
  - name: projectName
    description: "Project name"
    required: true
    default: "Untitled Project"
  - name: author
    description: "Author name"
    required: false
tags: [template-type, category]
---

# {{title}}

Content with {{variables}} that get replaced...
```

## Template Categories

### Built-in Templates
- `session-template.md` - Development session logs
- `decision-template.md` - Architecture decisions (ADRs)
- `pattern-template.md` - Design patterns
- `solution-template.md` - Problem solutions
- `snippet-template.md` - Code snippets
- `meeting-template.md` - Meeting notes
- `review-template.md` - Code reviews
- `incident-template.md` - Incident reports

### Custom Templates
Users can create custom templates in any category by following the template format.

## Import System

### Webhook Configuration

```typescript
interface WebhookConfig {
  url: string;
  authType: 'none' | 'bearer' | 'api-key' | 'oauth';
  authCredentials?: string;
  headers?: Record<string, string>;
  syncInterval?: number; // minutes
  autoImport?: boolean;
}
```

### Template Sources

1. **GitHub Repositories**
   - Public template repos
   - Private repos with auth
   - Gists

2. **Template Marketplaces**
   - Community templates
   - Premium templates
   - Organization templates

3. **Custom APIs**
   - Company template servers
   - Team shared templates
   - Dynamic templates

## Usage

### Importing Templates

```typescript
// Via MCP tool
await importTemplate({
  source: 'https://api.example.com/templates/awesome-template',
  category: 'pattern',
  variables: {
    projectName: 'My Project',
    author: 'Jane Doe'
  }
});
```

### Template Registry

All imported templates are tracked in `.template-registry.json`:

```json
{
  "templates": [
    {
      "id": "uuid",
      "name": "Awesome Template",
      "source": "https://...",
      "version": "1.0",
      "imported": "2025-01-05T10:00:00Z",
      "lastUpdated": "2025-01-05T10:00:00Z",
      "category": "pattern",
      "checksum": "sha256:..."
    }
  ],
  "sources": [
    {
      "name": "Company Templates",
      "url": "https://templates.company.com",
      "syncEnabled": true,
      "lastSync": "2025-01-05T10:00:00Z"
    }
  ]
}
```

## Security

### Validation
- Template structure validation
- Variable sanitization
- Content security checks
- Source verification

### Permissions
- Read-only webhook access
- Approval required for auto-import
- Audit log of all imports

---
*See implementation details in template-manager.ts*