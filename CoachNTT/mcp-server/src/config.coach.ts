/**
 * Configuration for CoachNTT
 * Simplified config without import issues
 */

import { z } from 'zod';

const ConfigSchema = z.object({
  // ChromaDB Configuration
  chromaHost: z.string().default('localhost'),
  chromaPort: z.string().default('8000'),
  
  // PostgreSQL Configuration
  postgresHost: z.string().default('localhost'),
  postgresPort: z.number().default(5432),
  postgresDatabase: z.string().default('coachntt_memory'),
  postgresUser: z.string().default('coachntt_user'),
  postgresPassword: z.string().default('coachntt_pass'),
  
  // OpenAI Configuration
  openaiApiKey: z.string(),
  
  // Memory Configuration
  memoryImportanceThreshold: z.number().default(0.6),
  memoryCollectionName: z.string().default('coachntt_memories'),
  maxMemoryResults: z.number().default(20),
  
  // Server Configuration
  serverName: z.string().default('CoachNTT'),
  serverVersion: z.string().default('1.0.0'),
  
  // Feature Flags
  useHybridStorage: z.boolean().default(true),
  enableDualWrite: z.boolean().default(true),
  postgresReadRatio: z.number().default(0.5),
  codeIndexingEnabled: z.boolean().default(true),
  tierEnabled: z.boolean().default(true),
  
  // Environment
  isDocker: z.boolean().default(false),
  isDevelopment: z.boolean().default(false),
  environment: z.string().default('PRODUCTION'),
});

// Load environment variables
const loadConfig = () => {
  // Load from process.env
  const envConfig = {
    chromaHost: process.env.CHROMA_HOST || 'localhost',
    chromaPort: process.env.CHROMA_PORT || '8000',
    postgresHost: process.env.POSTGRES_HOST || 'localhost',
    postgresPort: parseInt(process.env.POSTGRES_PORT || '5432'),
    postgresDatabase: process.env.POSTGRES_DATABASE || 'coachntt_memory',
    postgresUser: process.env.POSTGRES_USER || 'coachntt_user',
    postgresPassword: process.env.POSTGRES_PASSWORD || 'coachntt_pass',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    memoryImportanceThreshold: parseFloat(process.env.MEMORY_IMPORTANCE_THRESHOLD || '0.6'),
    memoryCollectionName: process.env.MEMORY_COLLECTION_NAME || 'coachntt_memories',
    maxMemoryResults: parseInt(process.env.MAX_MEMORY_RESULTS || '20'),
    serverName: process.env.MCP_SERVER_NAME || 'CoachNTT',
    serverVersion: process.env.MCP_SERVER_VERSION || '1.0.0',
    useHybridStorage: process.env.USE_HYBRID_STORAGE === 'true',
    enableDualWrite: process.env.ENABLE_DUAL_WRITE === 'true',
    postgresReadRatio: parseFloat(process.env.POSTGRES_READ_RATIO || '0.5'),
    codeIndexingEnabled: process.env.CODE_INDEXING_ENABLED === 'true',
    tierEnabled: process.env.TIER_ENABLED === 'true',
    isDocker: process.env.DOCKER_CONTAINER === 'true',
    isDevelopment: process.env.NODE_ENV === 'development',
    environment: process.env.ENVIRONMENT_NAME || 'PRODUCTION',
  };
  
  return ConfigSchema.parse(envConfig);
};

export const config = loadConfig();
export type Config = z.infer<typeof ConfigSchema>;