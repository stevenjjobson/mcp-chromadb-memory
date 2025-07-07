import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

// Determine which environment to load
const ENVIRONMENT = process.env.ENVIRONMENT_NAME || 'PRODUCTION';
const envFile = ENVIRONMENT === 'DEVELOPMENT' ? '.env.DEVELOPMENT' : '.env.PRODUCTION';

// Load .env file - handle Windows paths
// Suppress dotenv console output by redirecting process.stdout temporarily
const originalWrite = process.stdout.write;
process.stdout.write = () => true;
dotenv.config({ 
  path: path.resolve(process.cwd(), envFile)
});
process.stdout.write = originalWrite;

// Log which environment was loaded
console.error(`Loading configuration from: ${envFile}`);

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
  // Environment settings
  environment: z.string().default('PRODUCTION'),
  instanceLabel: z.string().default('🏭 PRODUCTION'),
  isDevelopment: z.boolean().default(false),
  
  // Core settings
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
  sessionLoggingSaveOnExit: z.boolean().default(true),
  
  // Feature flags
  tierEnabled: z.boolean().default(false),
  consolidationEnabled: z.boolean().default(false),
  patternRecognitionEnabled: z.boolean().default(false),
  
  // Tier configuration (only used if tierEnabled)
  tierConfig: z.object({
    workingRetention: z.number().default(48),
    sessionRetention: z.number().default(336),
    longTermRetention: z.number().default(8760),
    migrationInterval: z.number().default(3600000),
    workingMaxSize: z.number().default(1000),
    sessionMaxSize: z.number().default(5000),
    longTermMaxSize: z.number().default(50000)
  }).optional()
});

// Detect if running in Docker
const isDocker = process.env.DOCKER_CONTAINER === 'true';

export const config = ConfigSchema.parse({
  // Environment settings
  environment: ENVIRONMENT,
  instanceLabel: process.env.INSTANCE_LABEL || '🏭 PRODUCTION',
  isDevelopment: ENVIRONMENT === 'DEVELOPMENT',
  
  // Core settings
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
  sessionLoggingSaveOnExit: process.env.SESSION_LOGGING_SAVE_ON_EXIT !== 'false',
  
  // Feature flags
  tierEnabled: process.env.TIER_ENABLED === 'true',
  consolidationEnabled: process.env.CONSOLIDATION_ENABLED === 'true',
  patternRecognitionEnabled: process.env.PATTERN_RECOGNITION_ENABLED === 'true',
  
  // Tier configuration
  tierConfig: process.env.TIER_ENABLED === 'true' ? {
    workingRetention: parseInt(process.env.TIER_WORKING_RETENTION || '48'),
    sessionRetention: parseInt(process.env.TIER_SESSION_RETENTION || '336'),
    longTermRetention: parseInt(process.env.TIER_LONGTERM_RETENTION || '8760'),
    migrationInterval: parseInt(process.env.TIER_MIGRATION_INTERVAL || '3600000'),
    workingMaxSize: parseInt(process.env.TIER_WORKING_MAX_SIZE || '1000'),
    sessionMaxSize: parseInt(process.env.TIER_SESSION_MAX_SIZE || '5000'),
    longTermMaxSize: parseInt(process.env.TIER_LONGTERM_MAX_SIZE || '50000')
  } : undefined
});

export type Config = z.infer<typeof ConfigSchema>;

// Log configuration (useful for debugging Windows/Docker issues)
console.error(`
${'='.repeat(50)}
${config.instanceLabel} MCP Memory Server
Environment: ${config.environment}
ChromaDB URL: http://${config.chromaHost}:${config.chromaPort}
Collection: ${config.memoryCollectionName}
Running in Docker: ${config.isDocker}
Features: ${config.tierEnabled ? '✅ Tiers' : '❌ Tiers'} | ${config.consolidationEnabled ? '✅ Consolidation' : '❌ Consolidation'}
${'='.repeat(50)}
`);