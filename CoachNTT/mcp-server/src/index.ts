#!/usr/bin/env node
/**
 * CoachNTT MCP Server
 * Conversational AI for Codebase Intelligence
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from './config.js';
import { ConversationalMemoryManager } from './conversational-memory-manager.js';
import { CodeIntelligenceTools } from './tools/code-intelligence-tools.js';
import { ToolRegistry } from './tools/tool-registry.js';
import { sanitizeMetadata } from './utils/metadata-validator.js';
import { AudioSynthesisService } from './services/audio-synthesis-service.js';

// Handle Windows-specific process signals
if (process.platform === "win32") {
  const rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stderr
  });

  rl.on("SIGINT", function () {
    process.emit("SIGINT");
  });
}

// Initialize server
const server = new Server(
  {
    name: 'CoachNTT',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize services
let memoryManager: ConversationalMemoryManager;
let codeIntelligenceTools: CodeIntelligenceTools | null = null;
let audioSynthesisService: AudioSynthesisService | null = null;

// Initialize tool registry
const toolRegistry = new ToolRegistry();

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolRegistry.getTools()
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'health_check': {
        const isConnected = memoryManager ? await memoryManager.isConnected() : false;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'ok',
                service: 'CoachNTT',
                chromadb_connected: isConnected,
                version: '1.0.0',
                mode: 'conversational'
              }, null, 2)
            }
          ]
        };
      }
      
      case 'store_memory': {
        const metadata = args?.metadata ? sanitizeMetadata(args.metadata as Record<string, any>) : undefined;
        const storeResult = await memoryManager.storeMemory(
          args?.content as string,
          args?.context as string,
          metadata
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(storeResult, null, 2)
            }
          ]
        };
      }
      
      case 'recall_memories': {
        const memories = await memoryManager.recallMemories(
          args?.query as string,
          args?.context as string,
          args?.limit as number
        );
        
        const formattedMemories = memories.map(m => ({
          content: m.memory.content,
          context: m.memory.context,
          importance: m.memory.importance.toFixed(2),
          timestamp: m.memory.timestamp,
          conversationId: m.memory.conversationId,
          scores: {
            total: m.totalScore.toFixed(3),
            semantic: m.semanticScore.toFixed(3),
            recency: m.recencyScore.toFixed(3),
            importance: m.importanceScore.toFixed(3),
            frequency: m.frequencyScore.toFixed(3),
            conversation: m.conversationRelevance.toFixed(3)
          }
        }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedMemories, null, 2)
            }
          ]
        };
      }
      
      case 'search_exact': {
        const results = await memoryManager.searchExact(
          args?.query as string,
          args?.field as string,
          args?.limit as number
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2)
            }
          ]
        };
      }
      
      case 'search_hybrid': {
        const results = await memoryManager.recallMemories(
          args?.query as string,
          args?.context as string,
          args?.limit as number
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2)
            }
          ]
        };
      }
      
      // CoachNTT specific tools
      case 'start_conversation': {
        const session = memoryManager.startConversation(args?.metadata as Record<string, any>);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                conversationId: session.id,
                startTime: session.startTime,
                metadata: session.metadata
              }, null, 2)
            }
          ]
        };
      }
      
      case 'get_conversation_context': {
        const context = await memoryManager.getConversationContext(args?.maxTokens as number);
        return {
          content: [
            {
              type: 'text',
              text: context
            }
          ]
        };
      }
      
      // Audio synthesis tools
      case 'synthesize_audio': {
        if (!audioSynthesisService) {
          throw new Error('Audio synthesis service not available');
        }
        const request = {
          text: args?.text as string,
          options: {
            voice: args?.voice as string,
            speed: args?.speed as number,
            style: args?.style as number,
            stability: args?.stability as number,
            similarityBoost: args?.similarityBoost as number,
          }
        };
        const result = await audioSynthesisService.synthesize(request);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
      
      case 'get_available_voices': {
        if (!audioSynthesisService) {
          throw new Error('Audio synthesis service not available');
        }
        const voices = await audioSynthesisService.getVoices();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(voices, null, 2)
            }
          ]
        };
      }
      
      case 'check_audio_quota': {
        if (!audioSynthesisService) {
          throw new Error('Audio synthesis service not available');
        }
        const quota = await audioSynthesisService.checkQuota();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(quota, null, 2)
            }
          ]
        };
      }
      
      // Code intelligence tool handlers
      default: {
        if (codeIntelligenceTools) {
          const tool = codeIntelligenceTools.getTools().find(t => t.name === name);
          if (tool) {
            const result = await codeIntelligenceTools.handleToolCall(name, args);
            return {
              content: [
                {
                  type: 'text',
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }
              ]
            };
          }
        }
        
        throw new Error(`Unknown tool: ${name}`);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Error in tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: errorMessage,
            tool: name
          }, null, 2)
        }
      ]
    };
  }
});

// Main initialization
async function main() {
  try {
    console.error('🚀 Initializing CoachNTT MCP Server...');
    console.error(`Platform: ${process.platform}`);
    console.error(`Mode: Conversational AI for Codebase Intelligence`);
    
    // Initialize memory manager
    console.error('Initializing Conversational Memory Manager...');
    memoryManager = new ConversationalMemoryManager(config);
    await memoryManager.initialize();
    console.error('✅ Memory manager initialized');
    
    // Initialize code intelligence if enabled
    if (config.codeIndexingEnabled) {
      console.error('Initializing Code Intelligence...');
      codeIntelligenceTools = new CodeIntelligenceTools(memoryManager);
      toolRegistry.registerService('codeIntelligenceTools', codeIntelligenceTools);
      console.error('✅ Code intelligence initialized');
    }
    
    // Initialize audio synthesis service
    console.error('Initializing Audio Synthesis Service...');
    audioSynthesisService = new AudioSynthesisService();
    toolRegistry.registerService('audioSynthesisService', audioSynthesisService);
    console.error(`✅ Audio synthesis initialized (${audioSynthesisService.isAvailable() ? 'ElevenLabs' : 'Fallback TTS'})`);
    
    
    // Add CoachNTT specific tools to registry
    toolRegistry.registerService('conversationalTools', {
      getTools: () => [
        {
          name: 'start_conversation',
          description: 'Start a new conversation session',
          inputSchema: {
            shape: {
              metadata: {
                _def: { typeName: 'ZodObject' },
                description: 'Optional metadata for the conversation',
                isOptional: () => true
              }
            }
          }
        },
        {
          name: 'get_conversation_context',
          description: 'Get the current conversation context',
          inputSchema: {
            shape: {
              maxTokens: {
                _def: { typeName: 'ZodNumber', defaultValue: () => 1000 },
                description: 'Maximum tokens to return',
                isOptional: () => true
              }
            }
          }
        }
      ]
    });
    
    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('✅ CoachNTT MCP Server running on stdio transport');
    console.error('💡 Ready for conversational AI interactions');
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('\n🛑 Shutting down CoachNTT gracefully...');
  await server.close();
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});