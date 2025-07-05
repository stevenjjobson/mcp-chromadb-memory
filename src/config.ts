import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

// Load .env file - handle Windows paths
// Suppress dotenv console output by redirecting process.stdout temporarily
const originalWrite = process.stdout.write;
process.stdout.write = () => true;
dotenv.config({ 
  path: path.resolve(process.cwd(), '.env')
});
process.stdout.write = originalWrite;

// Helper function to read from Docker secrets or environment variables
function getSecret(secretName: string, envVar: string): string | undefined {
  // First, try to read from Docker secret file
  const secretPath = `/run/secrets/${secretName}`;
  if (fs.existsSync(secretPath)) {
    try {
      return fs.readFileSync(secretPath, 'utf-8').trim();
    } catch (error) {
      console.error(`Failed to read secret from ${secretPath}:`, error);
    }
  }
  
  // Fall back to environment variable
  return process.env[envVar];
}

const ConfigSchema = z.object({
  chromaHost: z.string().default('localhost'),
  chromaPort: z.string().default('8000'),
  openaiApiKey: z.string(),
  memoryImportanceThreshold: z.number().default(0.7),
  memoryCollectionName: z.string().default('ai_memories'),
  maxMemoryResults: z.number().default(10),
  serverName: z.string().default('ai-memory-server'),
  serverVersion: z.string().default('1.0.0'),
  isDocker: z.boolean().default(false),
  // Session logging configuration
  autoStartSessionLogging: z.boolean().default(false),
  sessionLoggingProjectName: z.string().optional(),
  sessionLoggingSaveOnExit: z.boolean().default(true)
});

// Detect if running in Docker
const isDocker = process.env.DOCKER_CONTAINER === 'true';

export const config = ConfigSchema.parse({
  chromaHost: isDocker ? 'chromadb' : (process.env.CHROMA_HOST || 'localhost'),
  chromaPort: process.env.CHROMA_PORT,
  openaiApiKey: getSecret('openai_api_key', 'OPENAI_API_KEY'),
  memoryImportanceThreshold: parseFloat(process.env.MEMORY_IMPORTANCE_THRESHOLD || '0.7'),
  memoryCollectionName: process.env.MEMORY_COLLECTION_NAME,
  maxMemoryResults: parseInt(process.env.MAX_MEMORY_RESULTS || '10'),
  serverName: process.env.MCP_SERVER_NAME,
  serverVersion: process.env.MCP_SERVER_VERSION,
  isDocker,
  // Session logging configuration
  autoStartSessionLogging: process.env.AUTO_START_SESSION_LOGGING === 'true',
  sessionLoggingProjectName: process.env.SESSION_LOGGING_PROJECT_NAME,
  sessionLoggingSaveOnExit: process.env.SESSION_LOGGING_SAVE_ON_EXIT !== 'false'
});

export type Config = z.infer<typeof ConfigSchema>;

// Log configuration (useful for debugging Windows/Docker issues)
console.error(`ChromaDB URL: http://${config.chromaHost}:${config.chromaPort}`);
console.error(`Running in Docker: ${config.isDocker}`);