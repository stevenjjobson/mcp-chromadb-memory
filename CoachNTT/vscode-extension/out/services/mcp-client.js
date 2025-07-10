"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPClient = void 0;
exports.getMCPClient = getMCPClient;
exports.disposeMCPClient = disposeMCPClient;
const vscode = __importStar(require("vscode"));
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
class MCPClient {
    constructor() {
        this.client = null;
        this.transport = null;
        this.connected = false;
        this.outputChannel = vscode.window.createOutputChannel('CoachNTT MCP Client');
        this.connectionStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.updateStatusBar();
    }
    /**
     * Connect to the MCP server
     */
    async connect(config) {
        try {
            this.outputChannel.appendLine(`Connecting to MCP server...`);
            this.outputChannel.appendLine(`Server path: ${config.serverPath}`);
            this.outputChannel.appendLine(`Server args: ${JSON.stringify(config.serverArgs || [])}`);
            // Create the stdio transport
            this.transport = new stdio_js_1.StdioClientTransport({
                command: config.serverPath,
                args: config.serverArgs || [],
                env: {
                    ...process.env,
                    ...config.env
                }
            });
            // Create the client
            this.client = new index_js_1.Client({
                name: 'coachntt-vscode',
                version: '1.0.0'
            });
            // Set up error handling
            this.transport.onerror = (error) => {
                this.outputChannel.appendLine(`Transport error: ${error.message}`);
                vscode.window.showErrorMessage(`MCP Connection Error: ${error.message}`);
                this.disconnect();
            };
            // Connect to the server
            await this.client.connect(this.transport);
            this.connected = true;
            this.updateStatusBar();
            this.outputChannel.appendLine('Successfully connected to MCP server');
            vscode.window.showInformationMessage('Connected to CoachNTT MCP server');
            // List available tools
            await this.listAvailableTools();
        }
        catch (error) {
            this.outputChannel.appendLine(`Connection failed: ${error}`);
            vscode.window.showErrorMessage(`Failed to connect to MCP server: ${error}`);
            this.disconnect();
            throw error;
        }
    }
    /**
     * Disconnect from the MCP server
     */
    async disconnect() {
        try {
            if (this.client && this.connected) {
                await this.client.close();
            }
            if (this.transport) {
                await this.transport.close();
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`Error during disconnect: ${error}`);
        }
        finally {
            this.client = null;
            this.transport = null;
            this.connected = false;
            this.updateStatusBar();
            this.outputChannel.appendLine('Disconnected from MCP server');
        }
    }
    /**
     * Check if connected to MCP server
     */
    isConnected() {
        return this.connected;
    }
    /**
     * List available tools from the MCP server
     */
    async listAvailableTools() {
        if (!this.client || !this.connected) {
            throw new Error('Not connected to MCP server');
        }
        try {
            const result = await this.client.listTools();
            this.outputChannel.appendLine(`Available tools: ${result.tools.map(t => t.name).join(', ')}`);
            return result.tools;
        }
        catch (error) {
            this.outputChannel.appendLine(`Failed to list tools: ${error}`);
            throw error;
        }
    }
    /**
     * Call a tool on the MCP server
     */
    async callTool(name, args) {
        if (!this.client || !this.connected) {
            throw new Error('Not connected to MCP server');
        }
        try {
            this.outputChannel.appendLine(`Calling tool: ${name} with args: ${JSON.stringify(args || {})}`);
            const result = await this.client.callTool({
                name,
                arguments: args
            });
            this.outputChannel.appendLine(`Tool result: ${JSON.stringify(result)}`);
            return result;
        }
        catch (error) {
            this.outputChannel.appendLine(`Tool call failed: ${error}`);
            throw error;
        }
    }
    /**
     * Memory-specific tool wrappers
     */
    async storeMemory(content, metadata) {
        return this.callTool('store_memory', { content, metadata });
    }
    async recallMemories(query, limit) {
        return this.callTool('recall_memories', { query, limit });
    }
    async searchExact(query, field, limit) {
        return this.callTool('search_exact', { query, field, limit });
    }
    async searchHybrid(query, exactWeight, limit) {
        return this.callTool('search_hybrid', { query, exact_weight: exactWeight, limit });
    }
    async getMemoryStats() {
        return this.callTool('get_memory_stats');
    }
    async getTierStats() {
        return this.callTool('get_tier_stats');
    }
    /**
     * Audio synthesis tool wrappers
     */
    async synthesizeAudio(text, voiceId) {
        return this.callTool('synthesize_audio', { text, voice_id: voiceId });
    }
    async getAvailableVoices() {
        return this.callTool('get_available_voices');
    }
    async checkAudioQuota() {
        return this.callTool('check_audio_quota');
    }
    /**
     * Session management tool wrappers
     */
    async startSessionLogging(project) {
        return this.callTool('start_session_logging', { project });
    }
    async saveSessionLog(summary) {
        return this.callTool('save_session_log', { summary });
    }
    /**
     * Code intelligence tool wrappers
     */
    async indexCodebase(path, patterns) {
        return this.callTool('index_codebase', { path, patterns });
    }
    async findSymbol(query, type, limit) {
        return this.callTool('find_symbol', { query, type, limit });
    }
    async getSymbolContext(symbolId) {
        return this.callTool('get_symbol_context', { symbol_id: symbolId });
    }
    async analyzeCodePatterns(path) {
        return this.callTool('analyze_code_patterns', { path });
    }
    /**
     * Update the status bar item
     */
    updateStatusBar() {
        if (this.connected) {
            this.connectionStatusBar.text = '$(plug) CoachNTT Connected';
            this.connectionStatusBar.tooltip = 'Connected to CoachNTT MCP server';
            this.connectionStatusBar.backgroundColor = undefined;
        }
        else {
            this.connectionStatusBar.text = '$(debug-disconnect) CoachNTT Disconnected';
            this.connectionStatusBar.tooltip = 'Click to connect to CoachNTT MCP server';
            this.connectionStatusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        this.connectionStatusBar.command = 'coachntt.toggleConnection';
        this.connectionStatusBar.show();
    }
    /**
     * Get the output channel for debugging
     */
    getOutputChannel() {
        return this.outputChannel;
    }
    /**
     * Dispose of resources
     */
    dispose() {
        this.disconnect();
        this.connectionStatusBar.dispose();
        this.outputChannel.dispose();
    }
}
exports.MCPClient = MCPClient;
// Singleton instance
let mcpClientInstance = null;
/**
 * Get or create the MCP client singleton
 */
function getMCPClient() {
    if (!mcpClientInstance) {
        mcpClientInstance = new MCPClient();
    }
    return mcpClientInstance;
}
/**
 * Dispose of the MCP client singleton
 */
function disposeMCPClient() {
    if (mcpClientInstance) {
        mcpClientInstance.dispose();
        mcpClientInstance = null;
    }
}
//# sourceMappingURL=mcp-client.js.map