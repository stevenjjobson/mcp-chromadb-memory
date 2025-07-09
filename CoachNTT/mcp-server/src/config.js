/**
 * Configuration for CoachNTT MCP Server
 */

export const config = {
  // ChromaDB connection
  chromaUrl: process.env.CHROMA_URL || 'http://localhost:8000',
  chromaCollection: process.env.CHROMA_COLLECTION || 'coachntt_memories',
  
  // PostgreSQL connection
  postgresHost: process.env.POSTGRES_HOST || 'localhost',
  postgresPort: parseInt(process.env.POSTGRES_PORT || '5432'),
  postgresDatabase: process.env.POSTGRES_DB || 'mcp_memory',
  postgresUser: process.env.POSTGRES_USER || 'mcp_user',
  postgresPassword: process.env.POSTGRES_PASSWORD || 'mcp_password',
  
  // Code intelligence settings
  codeIndexingEnabled: process.env.CODE_INDEXING_ENABLED === 'true',
  
  // Audio settings
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  
  // OpenAI settings for embeddings
  openaiApiKey: process.env.OPENAI_API_KEY,
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  
  // Docker mode detection
  isDocker: process.env.DOCKER_CONTAINER === 'true',
};