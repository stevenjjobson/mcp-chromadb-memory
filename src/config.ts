import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

// Load environment configuration
const envFile = '.env';

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

// Helper function to read from Docker secrets, local secrets folder, or environment variables
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
  
  // Second, try to read from local secrets folder (for development)
  const localSecretPath = path.resolve(process.cwd(), 'secrets', `${secretName}.txt`);
  if (fs.existsSync(localSecretPath)) {
    try {
      return fs.readFileSync(localSecretPath, 'utf-8').trim();
    } catch (error) {
      console.error(`Failed to read secret from ${localSecretPath}:`, error);
    }
  }
  
  // Fall back to environment variable
  return process.env[envVar];
}

const ConfigSchema = z.object({
  // Environment settings
  environment: z.string().default('PRODUCTION'),
  instanceLabel: z.string().default('🏭 PRODUCTION'),
  
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
  
  // Code Intelligence configuration
  codeIndexingEnabled: z.boolean().default(false),
  codeIndexingPatterns: z.string().default('**/*.{js,ts,py,java,go,rs,cpp}'),
  codeIndexingExclude: z.string().default('**/node_modules/**,**/dist/**,**/.git/**'),
  codePatternDetection: z.boolean().default(false),
  codeStreamingEnabled: z.boolean().default(true),
  codeCacheSize: z.number().default(1000),
  codeSymbolContextLines: z.number().default(15),
  
  // Batch and rate limiting configuration
  batchSize: z.number().default(100),
  batchDelayMs: z.number().default(200),
  maxConcurrentBatches: z.number().default(3),
  retryAttempts: z.number().default(3),
  retryDelayMs: z.number().default(1000),
  
  // PostgreSQL configuration
  postgresHost: z.string().default('localhost'),
  postgresPort: z.number().default(5432),
  postgresDatabase: z.string().default('mcp_memory'),
  postgresUser: z.string().default('mcp_user'),
  postgresPassword: z.string(),
  postgresPoolMax: z.number().default(20),
  postgresPoolMin: z.number().default(5),
  postgresIdleTimeout: z.number().default(30000),
  postgresConnectionTimeout: z.number().default(2000),
  
  // Hybrid storage feature flags
  useHybridStorage: z.boolean().default(false),
  enableDualWrite: z.boolean().default(false),
  postgresReadRatio: z.number().default(0.0), // 0-1, percentage of reads from PostgreSQL
  
  // Tier configuration (only used if tierEnabled)
  tierConfig: z.object({
    workingRetention: z.number().default(48),
    sessionRetention: z.number().default(336),
    longTermRetention: z.number().default(8760),
    migrationInterval: z.number().default(3600000),
    workingMaxSize: z.number().default(1000),
    sessionMaxSize: z.number().default(5000),
    longTermMaxSize: z.number().default(50000)
  }).optional(),
  
  // Vault configuration
  vaultMode: z.enum(['single', 'dual', 'multi']).default('single'),
  coreVaultPath: z.string().optional(),
  projectVaultPath: z.string().optional(),
  defaultVaultContext: z.enum(['core', 'project']).default('project'),
  enableCrossVaultSearch: z.boolean().default(false),
  vaultSearchStrategy: z.enum(['weighted', 'sequential', 'parallel']).default('weighted'),
  coreVaultWeight: z.number().default(0.3),
  projectVaultWeight: z.number().default(0.7),
  
  // Auto-categorization
  enableAutoCategorization: z.boolean().default(true),
  categorizationConfidence: z.number().default(0.8),
  promotionThreshold: z.number().default(3)
});

// Detect if running in Docker
const isDocker = process.env.DOCKER_CONTAINER === 'true';

export const config = ConfigSchema.parse({
  // Environment settings
  environment: 'PRODUCTION',
  instanceLabel: process.env.INSTANCE_LABEL || '🏭 PRODUCTION',
  
  // Core settings
  chromaHost: process.env.CHROMA_HOST || (isDocker ? 'chromadb' : 'localhost'),
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
  
  // Code Intelligence configuration
  codeIndexingEnabled: process.env.CODE_INDEXING_ENABLED === 'true',
  codeIndexingPatterns: process.env.CODE_INDEXING_PATTERNS || '**/*.{js,ts,py,java,go,rs,cpp}',
  codeIndexingExclude: process.env.CODE_INDEXING_EXCLUDE || '**/node_modules/**,**/dist/**,**/.git/**',
  codePatternDetection: process.env.CODE_PATTERN_DETECTION === 'true',
  codeStreamingEnabled: process.env.CODE_STREAMING_ENABLED !== 'false',
  codeCacheSize: parseInt(process.env.CODE_CACHE_SIZE || '1000'),
  codeSymbolContextLines: parseInt(process.env.CODE_SYMBOL_CONTEXT_LINES || '15'),
  
  // Batch and rate limiting configuration
  batchSize: parseInt(process.env.BATCH_SIZE || '100'),
  batchDelayMs: parseInt(process.env.BATCH_DELAY_MS || '200'),
  maxConcurrentBatches: parseInt(process.env.MAX_CONCURRENT_BATCHES || '3'),
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000'),
  
  // PostgreSQL configuration
  postgresHost: process.env.POSTGRES_HOST || (isDocker ? 'coachntt-postgres' : 'localhost'),
  postgresPort: parseInt(process.env.POSTGRES_PORT || '5432'),
  postgresDatabase: process.env.POSTGRES_DB || process.env.POSTGRES_DATABASE || 'coachntt_cognitive_db',
  postgresUser: process.env.POSTGRES_USER || 'coachntt_user',
  postgresPassword: getSecret('postgres_password', 'POSTGRES_PASSWORD') || 'coachntt_pass',
  postgresPoolMax: parseInt(process.env.POSTGRES_POOL_MAX || '20'),
  postgresPoolMin: parseInt(process.env.POSTGRES_POOL_MIN || '5'),
  postgresIdleTimeout: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
  postgresConnectionTimeout: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '2000'),
  
  // Hybrid storage feature flags
  useHybridStorage: process.env.USE_HYBRID_STORAGE === 'true',
  enableDualWrite: process.env.ENABLE_DUAL_WRITE === 'true',
  postgresReadRatio: parseFloat(process.env.POSTGRES_READ_RATIO || '0.0'),
  
  // Tier configuration
  tierConfig: process.env.TIER_ENABLED === 'true' ? {
    workingRetention: parseInt(process.env.TIER_WORKING_RETENTION || '48'),
    sessionRetention: parseInt(process.env.TIER_SESSION_RETENTION || '336'),
    longTermRetention: parseInt(process.env.TIER_LONGTERM_RETENTION || '8760'),
    migrationInterval: parseInt(process.env.TIER_MIGRATION_INTERVAL || '3600000'),
    workingMaxSize: parseInt(process.env.TIER_WORKING_MAX_SIZE || '1000'),
    sessionMaxSize: parseInt(process.env.TIER_SESSION_MAX_SIZE || '5000'),
    longTermMaxSize: parseInt(process.env.TIER_LONGTERM_MAX_SIZE || '50000')
  } : undefined,
  
  // Vault configuration
  vaultMode: (process.env.VAULT_MODE as 'single' | 'dual' | 'multi') || 'single',
  coreVaultPath: process.env.CORE_VAULT_PATH,
  projectVaultPath: process.env.PROJECT_VAULT_PATH || process.env.OBSIDIAN_VAULT_PATH || './vault',
  defaultVaultContext: (process.env.DEFAULT_VAULT_CONTEXT as 'core' | 'project') || 'project',
  enableCrossVaultSearch: process.env.ENABLE_CROSS_VAULT_SEARCH === 'true',
  vaultSearchStrategy: (process.env.VAULT_SEARCH_STRATEGY as 'weighted' | 'sequential' | 'parallel') || 'weighted',
  coreVaultWeight: parseFloat(process.env.CORE_VAULT_WEIGHT || '0.3'),
  projectVaultWeight: parseFloat(process.env.PROJECT_VAULT_WEIGHT || '0.7'),
  
  // Auto-categorization
  enableAutoCategorization: process.env.ENABLE_AUTO_CATEGORIZATION !== 'false',
  categorizationConfidence: parseFloat(process.env.CATEGORIZATION_CONFIDENCE || '0.8'),
  promotionThreshold: parseInt(process.env.PROMOTION_THRESHOLD || '3')
});

export type Config = z.infer<typeof ConfigSchema>;

// Log configuration (useful for debugging Windows/Docker issues)
console.error(`
${'='.repeat(50)}
${config.instanceLabel} MCP Memory Server
Environment: ${config.environment}
ChromaDB URL: http://${config.chromaHost}:${config.chromaPort}
PostgreSQL: ${config.postgresHost}:${config.postgresPort}/${config.postgresDatabase}
Collection: ${config.memoryCollectionName}
Running in Docker: ${config.isDocker}
Features: ${config.tierEnabled ? '✅ Tiers' : '❌ Tiers'} | ${config.consolidationEnabled ? '✅ Consolidation' : '❌ Consolidation'} | ${config.codeIndexingEnabled ? '✅ Code Intelligence' : '❌ Code Intelligence'} | ${config.useHybridStorage ? '✅ Hybrid Storage' : '❌ Hybrid Storage'}
${'='.repeat(50)}
`);