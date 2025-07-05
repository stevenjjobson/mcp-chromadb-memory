import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load .env file - handle Windows paths
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ConfigSchema = z.object({
  chromaHost: z.string().default('localhost'),
  chromaPort: z.string().default('8000'),
  openaiApiKey: z.string(),
  memoryImportanceThreshold: z.number().default(0.7),
  memoryCollectionName: z.string().default('ai_memories'),
  maxMemoryResults: z.number().default(10),
  serverName: z.string().default('ai-memory-server'),
  serverVersion: z.string().default('1.0.0'),
  isDocker: z.boolean().default(false)
});

// Detect if running in Docker
const isDocker = process.env.DOCKER_CONTAINER === 'true';

export const config = ConfigSchema.parse({
  chromaHost: isDocker ? 'chromadb' : (process.env.CHROMA_HOST || 'localhost'),
  chromaPort: process.env.CHROMA_PORT,
  openaiApiKey: process.env.OPENAI_API_KEY,
  memoryImportanceThreshold: parseFloat(process.env.MEMORY_IMPORTANCE_THRESHOLD || '0.7'),
  memoryCollectionName: process.env.MEMORY_COLLECTION_NAME,
  maxMemoryResults: parseInt(process.env.MAX_MEMORY_RESULTS || '10'),
  serverName: process.env.MCP_SERVER_NAME,
  serverVersion: process.env.MCP_SERVER_VERSION,
  isDocker
});

export type Config = z.infer<typeof ConfigSchema>;

// Log configuration (useful for debugging Windows/Docker issues)
console.error(`ChromaDB URL: http://${config.chromaHost}:${config.chromaPort}`);
console.error(`Running in Docker: ${config.isDocker}`);