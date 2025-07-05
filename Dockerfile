FROM node:20-slim

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy TypeScript config
COPY tsconfig.json ./

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create non-root user
RUN useradd -m -u 1001 mcpuser

# Set environment to indicate Docker
ENV DOCKER_CONTAINER=true

USER mcpuser

CMD ["node", "dist/index.js"]