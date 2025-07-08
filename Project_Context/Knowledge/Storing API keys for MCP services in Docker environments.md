When storing API keys for MCP (Model Context Protocol) services in Docker environments, here are the secure approaches:
## Environment Variables (Recommended)

**At runtime:**

bash

```bash
docker run -e OPENAI_API_KEY="your-key-here" your-mcp-image
```

**With docker-compose:**

yaml

```yaml
version: '3.8'
services:
  mcp-service:
    image: your-mcp-image
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

Then use a `.env` file (never committed to version control):

```
OPENAI_API_KEY=sk-your-actual-key
ANTHROPIC_API_KEY=your-anthropic-key
```

## Docker Secrets (Production)

For Docker Swarm or production environments:

yaml

```yaml
version: '3.8'
services:
  mcp-service:
    image: your-mcp-image
    secrets:
      - openai_api_key
    environment:
      - OPENAI_API_KEY_FILE=/run/secrets/openai_api_key

secrets:
  openai_api_key:
    external: true
```

## Volume Mounts for Key Files

Mount a secure directory containing key files:

bash

```bash
docker run -v /secure/path:/app/secrets:ro your-mcp-image
```

Access keys from `/app/secrets/api-key.txt` inside the container.

## Key Security Practices

**Never do:**

- Hardcode keys in Dockerfiles or images
- Include keys in environment variables within Dockerfiles
- Commit `.env` files to version control

**Always do:**

- Use `.dockerignore` to exclude sensitive files
- Run containers as non-root users
- Use read-only file systems where possible
- Rotate keys regularly
- Use least-privilege access patterns

**For MCP specifically:** Since MCP services often need to authenticate with multiple AI providers, consider using a key management service like HashiCorp Vault or AWS Secrets Manager for production deployments, accessed via init containers or sidecar patterns.

The environment variable approach is typically sufficient for development and many production use cases, while Docker secrets provide additional security for orchestrated environments.