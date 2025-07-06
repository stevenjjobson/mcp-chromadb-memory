# Example Webhook Responses

## Template List Response

### GET https://templates.company.com/api/v1/templates

```json
{
  "templates": [
    {
      "id": "tpl_123abc",
      "name": "Sprint Retrospective",
      "description": "Template for sprint retrospective meetings",
      "category": "meeting",
      "version": "2.1.0",
      "author": "Platform Team",
      "created": "2024-06-15T10:00:00Z",
      "updated": "2024-12-01T14:30:00Z",
      "downloadUrl": "https://templates.company.com/api/v1/templates/tpl_123abc/content",
      "variables": [
        {
          "name": "sprintNumber",
          "type": "number",
          "required": true,
          "description": "Sprint number"
        },
        {
          "name": "teamName",
          "type": "string",
          "required": true,
          "description": "Team name"
        }
      ],
      "tags": ["agile", "scrum", "retrospective"]
    },
    {
      "id": "tpl_456def",
      "name": "API Documentation",
      "description": "Standard API endpoint documentation",
      "category": "documentation",
      "version": "1.3.0",
      "author": "API Team",
      "created": "2024-08-20T09:00:00Z",
      "updated": "2024-11-15T16:45:00Z",
      "downloadUrl": "https://templates.company.com/api/v1/templates/tpl_456def/content",
      "variables": [
        {
          "name": "endpoint",
          "type": "string",
          "required": true
        },
        {
          "name": "method",
          "type": "string",
          "required": true,
          "options": ["GET", "POST", "PUT", "DELETE", "PATCH"]
        }
      ],
      "tags": ["api", "documentation", "rest"]
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

## Single Template Content Response

### GET https://templates.company.com/api/v1/templates/tpl_123abc/content

```json
{
  "id": "tpl_123abc",
  "content": "---\ntemplate: true\nversion: 2.1.0\nname: \"Sprint Retrospective\"\n---\n\n# Sprint {{sprintNumber}} Retrospective - {{teamName}}\n\n## What Went Well\n{{#each wentWell}}\n- {{this}}\n{{/each}}\n\n## What Could Be Improved\n{{#each improvements}}\n- {{this}}\n{{/each}}\n\n## Action Items\n{{#each actionItems}}\n- {{this.item}} - @{{this.assignee}}\n{{/each}}",
  "checksum": "sha256:a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3",
  "metadata": {
    "downloads": 1523,
    "rating": 4.8,
    "lastUsed": "2025-01-04T10:30:00Z"
  }
}
```

## Webhook Event Payloads

### Template Created Event

```json
{
  "event": "template.created",
  "timestamp": "2025-01-05T14:30:00Z",
  "data": {
    "template": {
      "id": "tpl_789ghi",
      "name": "Bug Report Template",
      "category": "issue",
      "version": "1.0.0",
      "author": "QA Team"
    },
    "source": {
      "type": "manual",
      "user": "jane.doe@company.com"
    }
  },
  "signature": "hmac-sha256:abc123def456..."
}
```

### Template Updated Event

```json
{
  "event": "template.updated",
  "timestamp": "2025-01-05T15:00:00Z",
  "data": {
    "template": {
      "id": "tpl_123abc",
      "name": "Sprint Retrospective",
      "version": "2.2.0",
      "previousVersion": "2.1.0"
    },
    "changes": {
      "added": ["teamVelocity variable"],
      "removed": [],
      "modified": ["action items section"]
    }
  },
  "signature": "hmac-sha256:def789ghi012..."
}
```

## GitHub Templates Response

### GET https://api.github.com/repos/awesome-templates/dev-templates/contents/templates

```json
[
  {
    "name": "code-review.md",
    "path": "templates/code-review.md",
    "sha": "abc123...",
    "size": 2048,
    "url": "https://api.github.com/repos/awesome-templates/dev-templates/contents/templates/code-review.md",
    "html_url": "https://github.com/awesome-templates/dev-templates/blob/main/templates/code-review.md",
    "git_url": "https://api.github.com/repos/awesome-templates/dev-templates/git/blobs/abc123",
    "download_url": "https://raw.githubusercontent.com/awesome-templates/dev-templates/main/templates/code-review.md",
    "type": "file"
  },
  {
    "name": "architecture-decision.md",
    "path": "templates/architecture-decision.md",
    "sha": "def456...",
    "size": 3072,
    "url": "https://api.github.com/repos/awesome-templates/dev-templates/contents/templates/architecture-decision.md",
    "html_url": "https://github.com/awesome-templates/dev-templates/blob/main/templates/architecture-decision.md",
    "git_url": "https://api.github.com/repos/awesome-templates/dev-templates/git/blobs/def456",
    "download_url": "https://raw.githubusercontent.com/awesome-templates/dev-templates/main/templates/architecture-decision.md",
    "type": "file"
  }
]
```

## Template Marketplace Response

### GET https://templatemarket.io/api/v1/search?category=development

```json
{
  "results": [
    {
      "id": "mkt_abc123",
      "name": "Ultimate Code Review Template",
      "description": "Comprehensive code review template with security checklist",
      "author": {
        "name": "DevTools Pro",
        "verified": true
      },
      "price": {
        "amount": 0,
        "currency": "USD",
        "type": "free"
      },
      "stats": {
        "downloads": 15234,
        "rating": 4.9,
        "reviews": 234
      },
      "preview": "https://templatemarket.io/preview/mkt_abc123",
      "downloadUrl": "https://templatemarket.io/api/v1/download/mkt_abc123",
      "license": "MIT",
      "tags": ["code-review", "security", "best-practices"]
    },
    {
      "id": "mkt_def456",
      "name": "Enterprise Documentation Suite",
      "description": "Complete documentation template collection for enterprise teams",
      "author": {
        "name": "DocMasters",
        "verified": true
      },
      "price": {
        "amount": 49.99,
        "currency": "USD",
        "type": "premium"
      },
      "stats": {
        "downloads": 3421,
        "rating": 4.7,
        "reviews": 89
      },
      "preview": "https://templatemarket.io/preview/mkt_def456",
      "purchaseUrl": "https://templatemarket.io/purchase/mkt_def456",
      "license": "Commercial",
      "tags": ["enterprise", "documentation", "suite"]
    }
  ],
  "facets": {
    "categories": {
      "development": 234,
      "documentation": 156,
      "project-management": 89
    },
    "licenses": {
      "MIT": 189,
      "Apache-2.0": 67,
      "Commercial": 123
    }
  }
}
```

## Error Responses

### Authentication Error

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid API key provided",
    "details": "The API key 'sk_test_...' is not valid for this endpoint"
  },
  "status": 401
}
```

### Rate Limit Error

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": "Rate limit of 100 requests per hour exceeded",
    "retryAfter": 3600
  },
  "status": 429,
  "headers": {
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": "1704462000"
  }
}
```

### Template Not Found

```json
{
  "error": {
    "code": "TEMPLATE_NOT_FOUND",
    "message": "Template not found",
    "details": "No template found with ID 'tpl_invalid'",
    "suggestions": ["tpl_123abc", "tpl_456def"]
  },
  "status": 404
}
```

## Webhook Registration Response

### POST https://templates.company.com/api/v1/webhooks

Request:
```json
{
  "url": "https://myapp.com/webhooks/templates",
  "events": ["template.created", "template.updated"],
  "secret": "webhook_secret_key"
}
```

Response:
```json
{
  "id": "whk_123abc",
  "url": "https://myapp.com/webhooks/templates",
  "events": ["template.created", "template.updated"],
  "status": "active",
  "created": "2025-01-05T14:00:00Z",
  "verificationToken": "verify_abc123",
  "message": "Webhook registered successfully. Please verify by responding to the verification request."
}
```

---
*These examples demonstrate various webhook response formats for template integration*