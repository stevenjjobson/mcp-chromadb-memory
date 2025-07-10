import * as vscode from 'vscode';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { 
    CallToolResult,
    ListToolsResult,
    Tool
} from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';

export interface MCPClientConfig {
    serverPath: string;
    serverArgs?: string[];
    env?: Record<string, string>;
}

export class MCPClient {
    private client: Client | null = null;
    private transport: StdioClientTransport | null = null;
    private connected: boolean = false;
    private connectionStatusBar: vscode.StatusBarItem;
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('CoachNTT MCP Client');
        this.connectionStatusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        this.updateStatusBar();
    }

    /**
     * Connect to the MCP server
     */
    async connect(config: MCPClientConfig): Promise<void> {
        try {
            this.outputChannel.appendLine(`Connecting to MCP server...`);
            this.outputChannel.appendLine(`Server path: ${config.serverPath}`);
            this.outputChannel.appendLine(`Server args: ${JSON.stringify(config.serverArgs || [])}`);

            // Create the stdio transport
            this.transport = new StdioClientTransport({
                command: config.serverPath,
                args: config.serverArgs || [],
                env: {
                    ...process.env,
                    ...config.env
                } as Record<string, string>
            });

            // Create the client
            this.client = new Client({
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

        } catch (error) {
            this.outputChannel.appendLine(`Connection failed: ${error}`);
            vscode.window.showErrorMessage(`Failed to connect to MCP server: ${error}`);
            this.disconnect();
            throw error;
        }
    }

    /**
     * Disconnect from the MCP server
     */
    async disconnect(): Promise<void> {
        try {
            if (this.client && this.connected) {
                await this.client.close();
            }
            if (this.transport) {
                await this.transport.close();
            }
        } catch (error) {
            this.outputChannel.appendLine(`Error during disconnect: ${error}`);
        } finally {
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
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * List available tools from the MCP server
     */
    async listAvailableTools(): Promise<Tool[]> {
        if (!this.client || !this.connected) {
            throw new Error('Not connected to MCP server');
        }

        try {
            const result: ListToolsResult = await this.client.listTools();
            this.outputChannel.appendLine(`Available tools: ${result.tools.map(t => t.name).join(', ')}`);
            return result.tools;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to list tools: ${error}`);
            throw error;
        }
    }

    /**
     * Call a tool on the MCP server
     */
    async callTool(name: string, args?: Record<string, any>): Promise<CallToolResult> {
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
            return result as CallToolResult;
        } catch (error) {
            this.outputChannel.appendLine(`Tool call failed: ${error}`);
            throw error;
        }
    }

    /**
     * Memory-specific tool wrappers
     */
    async storeMemory(content: string, metadata?: Record<string, any>): Promise<any> {
        return this.callTool('store_memory', { content, metadata });
    }

    async recallMemories(query: string, limit?: number): Promise<any> {
        return this.callTool('recall_memories', { query, limit });
    }

    async searchExact(query: string, field?: string, limit?: number): Promise<any> {
        return this.callTool('search_exact', { query, field, limit });
    }

    async searchHybrid(query: string, exactWeight?: number, limit?: number): Promise<any> {
        return this.callTool('search_hybrid', { query, exact_weight: exactWeight, limit });
    }

    async getMemoryStats(): Promise<any> {
        return this.callTool('get_memory_stats');
    }

    async getTierStats(): Promise<any> {
        return this.callTool('get_tier_stats');
    }

    /**
     * Audio synthesis tool wrappers
     */
    async synthesizeAudio(text: string, voiceId?: string): Promise<any> {
        return this.callTool('synthesize_audio', { text, voice_id: voiceId });
    }

    async getAvailableVoices(): Promise<any> {
        return this.callTool('get_available_voices');
    }

    async checkAudioQuota(): Promise<any> {
        return this.callTool('check_audio_quota');
    }

    /**
     * Session management tool wrappers
     */
    async startSessionLogging(project?: string): Promise<any> {
        return this.callTool('start_session_logging', { project });
    }

    async saveSessionLog(summary?: string): Promise<any> {
        return this.callTool('save_session_log', { summary });
    }

    /**
     * Code intelligence tool wrappers
     */
    async indexCodebase(path?: string, patterns?: string): Promise<any> {
        return this.callTool('index_codebase', { path, patterns });
    }

    async findSymbol(query: string, type?: string, limit?: number): Promise<any> {
        return this.callTool('find_symbol', { query, type, limit });
    }

    async getSymbolContext(symbolId: string): Promise<any> {
        return this.callTool('get_symbol_context', { symbol_id: symbolId });
    }

    async analyzeCodePatterns(path?: string): Promise<any> {
        return this.callTool('analyze_code_patterns', { path });
    }

    /**
     * Update the status bar item
     */
    private updateStatusBar(): void {
        if (this.connected) {
            this.connectionStatusBar.text = '$(plug) CoachNTT Connected';
            this.connectionStatusBar.tooltip = 'Connected to CoachNTT MCP server';
            this.connectionStatusBar.backgroundColor = undefined;
        } else {
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
    getOutputChannel(): vscode.OutputChannel {
        return this.outputChannel;
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.disconnect();
        this.connectionStatusBar.dispose();
        this.outputChannel.dispose();
    }
}

// Singleton instance
let mcpClientInstance: MCPClient | null = null;

/**
 * Get or create the MCP client singleton
 */
export function getMCPClient(): MCPClient {
    if (!mcpClientInstance) {
        mcpClientInstance = new MCPClient();
    }
    return mcpClientInstance;
}

/**
 * Dispose of the MCP client singleton
 */
export function disposeMCPClient(): void {
    if (mcpClientInstance) {
        mcpClientInstance.dispose();
        mcpClientInstance = null;
    }
}