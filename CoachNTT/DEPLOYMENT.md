# CoachNTT Deployment Guide

Complete guide for deploying CoachNTT in production environments.

## Deployment Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   VSCode IDE    │────▶│  MCP Server     │────▶│   Databases     │
│  + Extension    │     │  (Node.js)      │     │ PostgreSQL      │
└─────────────────┘     └─────────────────┘     │ ChromaDB        │
                                                 └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │  External APIs  │
                        │  - OpenAI       │
                        │  - ElevenLabs   │
                        └─────────────────┘
```

## Production Deployment

### 1. Server Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- OS: Ubuntu 20.04+ / Debian 11+

**Recommended:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 50GB SSD
- OS: Ubuntu 22.04 LTS

### 2. Docker Deployment

#### Full Stack Deployment

Create `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: mcp_memory
      POSTGRES_USER: mcp_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mcp_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  chromadb:
    image: chromadb/chroma:latest
    volumes:
      - chroma_data:/chroma/chroma
    ports:
      - "8000:8000"
    environment:
      - ANONYMIZED_TELEMETRY=false
      - ALLOW_RESET=false
    restart: unless-stopped

  coachntt:
    build:
      context: ./mcp-server
      dockerfile: Dockerfile
    depends_on:
      postgres:
        condition: service_healthy
      chromadb:
        condition: service_started
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}
      - POSTGRES_HOST=postgres
      - POSTGRES_PORT=5432
      - POSTGRES_DB=mcp_memory
      - POSTGRES_USER=mcp_user
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - CHROMA_URL=http://chromadb:8000
    ports:
      - "3000:3000"
    restart: unless-stopped

volumes:
  postgres_data:
  chroma_data:
```

#### MCP Server Dockerfile

Create `CoachNTT/mcp-server/Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### 3. Kubernetes Deployment

#### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coachntt-config
data:
  NODE_ENV: "production"
  POSTGRES_HOST: "postgres-service"
  POSTGRES_PORT: "5432"
  POSTGRES_DB: "mcp_memory"
  POSTGRES_USER: "mcp_user"
  CHROMA_URL: "http://chromadb-service:8000"
```

#### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coachntt-mcp-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: coachntt
  template:
    metadata:
      labels:
        app: coachntt
    spec:
      containers:
      - name: mcp-server
        image: coachntt/mcp-server:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: coachntt-config
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: coachntt-secrets
              key: openai-api-key
        - name: ELEVENLABS_API_KEY
          valueFrom:
            secretKeyRef:
              name: coachntt-secrets
              key: elevenlabs-api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### 4. Environment Configuration

#### Production `.env`:

```env
# API Keys (use secrets management)
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mcp_memory
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=secure-password-here

# ChromaDB
CHROMA_URL=http://localhost:8000

# Performance
USE_HYBRID_STORAGE=true
ENABLE_DUAL_WRITE=true
POSTGRES_READ_RATIO=0.7

# Features
CODE_INDEXING_ENABLED=true
MEMORY_IMPORTANCE_THRESHOLD=0.7
MAX_MEMORY_RESULTS=50

# Audio
ELEVENLABS_MODEL=eleven_multilingual_v2
ELEVENLABS_DEFAULT_VOICE=21m00Tcm4TlvDq8ikWAM
```

## VSCode Extension Deployment

### 1. Building for Distribution

```bash
cd vscode-extension

# Install vsce
npm install -g vsce

# Package extension
vsce package

# This creates: coachntt-vscode-1.0.0.vsix
```

### 2. Publishing to Marketplace

```bash
# Login to publisher account
vsce login <publisher-name>

# Publish
vsce publish
```

### 3. Private Distribution

For enterprise deployment:

1. Host VSIX file on internal server
2. Users install via:
   ```bash
   code --install-extension https://internal.company.com/coachntt-vscode-1.0.0.vsix
   ```

## Security Considerations

### 1. API Key Management

**Never hardcode API keys!**

Use one of these approaches:
- Environment variables
- Kubernetes secrets
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault

### 2. Network Security

```nginx
# Nginx reverse proxy configuration
server {
    listen 443 ssl http2;
    server_name coachntt.yourdomain.com;

    ssl_certificate /etc/ssl/certs/coachntt.crt;
    ssl_certificate_key /etc/ssl/private/coachntt.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Database Security

```sql
-- Create read-only user for reporting
CREATE USER coachntt_read WITH PASSWORD 'secure-password';
GRANT CONNECT ON DATABASE mcp_memory TO coachntt_read;
GRANT USAGE ON SCHEMA public TO coachntt_read;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO coachntt_read;
```

## Monitoring

### 1. Health Checks

Add health endpoint to MCP server:

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      postgres: postgresHealthy,
      chromadb: chromadbHealthy,
      elevenlabs: elevenLabsHealthy
    }
  });
});
```

### 2. Prometheus Metrics

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'coachntt'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### 3. Logging

Configure structured logging:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

## Backup and Recovery

### 1. Database Backup

```bash
#!/bin/bash
# backup.sh

# PostgreSQL
pg_dump -h localhost -U mcp_user -d mcp_memory > backup_$(date +%Y%m%d).sql

# ChromaDB
tar -czf chromadb_backup_$(date +%Y%m%d).tar.gz /path/to/chroma/data

# Upload to S3
aws s3 cp backup_$(date +%Y%m%d).sql s3://backups/coachntt/
aws s3 cp chromadb_backup_$(date +%Y%m%d).tar.gz s3://backups/coachntt/
```

### 2. Restore Procedure

```bash
# Restore PostgreSQL
psql -h localhost -U mcp_user -d mcp_memory < backup_20240109.sql

# Restore ChromaDB
tar -xzf chromadb_backup_20240109.tar.gz -C /path/to/chroma/data
```

## Performance Tuning

### 1. PostgreSQL Optimization

```sql
-- postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
random_page_cost = 1.1
effective_io_concurrency = 200
```

### 2. Node.js Optimization

```javascript
// PM2 ecosystem.config.js
module.exports = {
  apps: [{
    name: 'coachntt',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    max_memory_restart: '1G'
  }]
};
```

## Troubleshooting

### Common Issues

1. **Memory Leaks**
   - Monitor with: `node --inspect dist/index.js`
   - Use Chrome DevTools for heap snapshots

2. **Slow Queries**
   - Enable PostgreSQL slow query log
   - Add indexes for frequently queried fields

3. **Audio Synthesis Failures**
   - Check ElevenLabs quota
   - Implement retry logic with exponential backoff

### Debug Mode

```bash
# Enable verbose logging
DEBUG=* NODE_ENV=development node dist/index.js
```

## Scaling Considerations

### Horizontal Scaling

1. **MCP Server**: Stateless, scale with load balancer
2. **PostgreSQL**: Use read replicas for queries
3. **ChromaDB**: Consider sharding for large datasets

### Vertical Scaling

Monitor and adjust:
- CPU usage > 80%: Add more cores
- Memory usage > 80%: Increase RAM
- Disk I/O wait > 20%: Upgrade to SSD

## Support

For deployment assistance:
- GitHub Issues: Tag with [deployment]
- Discord: #coachntt-deployment channel
- Email: support@coachntt.ai