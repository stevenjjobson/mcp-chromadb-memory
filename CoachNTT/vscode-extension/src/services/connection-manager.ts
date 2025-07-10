import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getMCPClient, MCPClientConfig } from './mcp-client';

export interface ServerConfig {
    type: 'docker' | 'local' | 'remote';
    dockerImage?: string;
    localPath?: string;
    remoteUrl?: string;
    apiKey?: string;
    envVars?: Record<string, string>;
}

export class ConnectionManager {
    private context: vscode.ExtensionContext;
    private config: vscode.WorkspaceConfiguration;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = vscode.workspace.getConfiguration('coachntt');
    }

    /**
     * Get the server configuration from VSCode settings
     */
    private getServerConfig(): ServerConfig {
        const host = this.config.get<string>('server.host', 'localhost');
        const port = this.config.get<number>('server.port', 3000);
        const apiKey = this.config.get<string>('server.apiKey', '');

        // Check if running locally
        const localServerPath = this.findLocalServer();
        if (localServerPath) {
            return {
                type: 'local',
                localPath: localServerPath,
                apiKey,
                envVars: this.getEnvironmentVariables()
            };
        }

        // Check if Docker is available
        if (this.isDockerAvailable()) {
            return {
                type: 'docker',
                dockerImage: 'coachntt-mcp-server:latest',
                apiKey,
                envVars: this.getEnvironmentVariables()
            };
        }

        // Default to remote connection
        return {
            type: 'remote',
            remoteUrl: `http://${host}:${port}`,
            apiKey
        };
    }

    /**
     * Find the local MCP server executable
     */
    private findLocalServer(): string | null {
        // Try to find the MCP server in common locations
        const possiblePaths = [
            // Relative to the extension
            path.join(this.context.extensionPath, '..', 'mcp-server', 'dist', 'index.js'),
            path.join(this.context.extensionPath, '..', 'mcp-server', 'dist', 'index-coachntt.js'),
            // In the parent directory
            path.join(this.context.extensionPath, '..', '..', 'dist', 'index.js'),
            path.join(this.context.extensionPath, '..', '..', 'dist', 'index-coachntt.js'),
            // Absolute path from workspace root
            path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'CoachNTT', 'mcp-server', 'dist', 'index.js'),
            path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'CoachNTT', 'mcp-server', 'dist', 'index-coachntt.js'),
        ];

        for (const serverPath of possiblePaths) {
            if (fs.existsSync(serverPath)) {
                return serverPath;
            }
        }

        return null;
    }

    /**
     * Check if Docker is available
     */
    private isDockerAvailable(): boolean {
        try {
            const { execSync } = require('child_process');
            execSync('docker --version', { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get environment variables for the MCP server
     */
    private getEnvironmentVariables(): Record<string, string> {
        const env: Record<string, string> = {};

        // Get API keys from settings or environment
        const openaiKey = this.config.get<string>('server.openaiApiKey') || process.env.OPENAI_API_KEY;
        const elevenLabsKey = this.config.get<string>('server.elevenLabsApiKey') || process.env.ELEVENLABS_API_KEY;

        if (openaiKey) env.OPENAI_API_KEY = openaiKey;
        if (elevenLabsKey) env.ELEVENLABS_API_KEY = elevenLabsKey;

        // ChromaDB configuration
        env.CHROMA_HOST = this.config.get<string>('server.chromaHost', 'localhost');
        env.CHROMA_PORT = this.config.get<string>('server.chromaPort', '8000');

        // PostgreSQL configuration
        env.POSTGRES_HOST = this.config.get<string>('server.postgresHost', 'localhost');
        env.POSTGRES_PORT = this.config.get<string>('server.postgresPort', '5432');
        env.POSTGRES_DB = this.config.get<string>('server.postgresDb', 'memory_db');
        env.POSTGRES_USER = this.config.get<string>('server.postgresUser', 'postgres');
        env.POSTGRES_PASSWORD = this.config.get<string>('server.postgresPassword', 'postgres');

        // Hybrid storage configuration
        env.USE_HYBRID_STORAGE = 'true';
        env.ENABLE_DUAL_WRITE = 'true';
        env.POSTGRES_READ_RATIO = '0.5';

        // Session logging
        env.AUTO_START_SESSION_LOGGING = String(this.config.get<boolean>('session.autoStart', true));
        env.SESSION_LOGGING_PROJECT_NAME = this.config.get<string>('session.projectName', 'CoachNTT VSCode');

        // Code intelligence
        env.CODE_INDEXING_ENABLED = String(this.config.get<boolean>('codeIntelligence.enabled', true));

        return env;
    }

    /**
     * Build the MCP client configuration
     */
    private async buildMCPConfig(serverConfig: ServerConfig): Promise<MCPClientConfig> {
        switch (serverConfig.type) {
            case 'local':
                return {
                    serverPath: 'node',
                    serverArgs: [serverConfig.localPath!],
                    env: serverConfig.envVars
                };

            case 'docker':
                return {
                    serverPath: 'docker',
                    serverArgs: [
                        'run',
                        '-i',
                        '--rm',
                        '--name', 'coachntt-mcp-vscode',
                        '--network', 'mcp-chromadb-memory_memory-network',
                        ...Object.entries(serverConfig.envVars || {}).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
                        serverConfig.dockerImage!
                    ],
                    env: {}
                };

            case 'remote':
                throw new Error('Remote MCP connections not yet implemented');

            default:
                throw new Error(`Unknown server type: ${serverConfig.type}`);
        }
    }

    /**
     * Connect to the MCP server
     */
    async connect(): Promise<void> {
        const mcpClient = getMCPClient();

        if (mcpClient.isConnected()) {
            vscode.window.showInformationMessage('Already connected to CoachNTT MCP server');
            return;
        }

        try {
            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Connecting to CoachNTT MCP server...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 20, message: 'Getting server configuration...' });
                const serverConfig = this.getServerConfig();

                progress.report({ increment: 20, message: 'Building connection configuration...' });
                const mcpConfig = await this.buildMCPConfig(serverConfig);

                progress.report({ increment: 40, message: 'Establishing connection...' });
                await mcpClient.connect(mcpConfig);

                progress.report({ increment: 20, message: 'Connection established!' });
            });

            // Store connection state
            await this.context.workspaceState.update('coachntt.connected', true);
            await this.context.workspaceState.update('coachntt.lastConnected', new Date().toISOString());

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to connect: ${error}`);
            throw error;
        }
    }

    /**
     * Disconnect from the MCP server
     */
    async disconnect(): Promise<void> {
        const mcpClient = getMCPClient();

        if (!mcpClient.isConnected()) {
            vscode.window.showInformationMessage('Not connected to CoachNTT MCP server');
            return;
        }

        try {
            await mcpClient.disconnect();
            await this.context.workspaceState.update('coachntt.connected', false);
            vscode.window.showInformationMessage('Disconnected from CoachNTT MCP server');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to disconnect: ${error}`);
            throw error;
        }
    }

    /**
     * Toggle connection state
     */
    async toggleConnection(): Promise<void> {
        const mcpClient = getMCPClient();

        if (mcpClient.isConnected()) {
            await this.disconnect();
        } else {
            await this.connect();
        }
    }

    /**
     * Auto-connect if enabled
     */
    async autoConnect(): Promise<void> {
        const autoConnect = this.config.get<boolean>('server.autoConnect', true);
        const wasConnected = this.context.workspaceState.get<boolean>('coachntt.connected', false);

        if (autoConnect || wasConnected) {
            try {
                await this.connect();
            } catch (error) {
                console.error('Auto-connect failed:', error);
                // Don't show error message for auto-connect failures
            }
        }
    }

    /**
     * Configure server settings
     */
    async configureServer(): Promise<void> {
        const choice = await vscode.window.showQuickPick([
            { label: '$(key) Configure API Keys', value: 'apiKeys' },
            { label: '$(database) Configure Databases', value: 'databases' },
            { label: '$(server) Configure Server Type', value: 'serverType' },
            { label: '$(gear) Open Settings', value: 'settings' }
        ], {
            placeHolder: 'What would you like to configure?'
        });

        switch (choice?.value) {
            case 'apiKeys':
                await this.configureApiKeys();
                break;
            case 'databases':
                await this.configureDatabases();
                break;
            case 'serverType':
                await this.configureServerType();
                break;
            case 'settings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'coachntt');
                break;
        }
    }

    private async configureApiKeys(): Promise<void> {
        const openaiKey = await vscode.window.showInputBox({
            prompt: 'Enter your OpenAI API key',
            password: true,
            placeHolder: 'sk-...',
            value: this.config.get<string>('server.openaiApiKey', '')
        });

        if (openaiKey !== undefined) {
            await this.config.update('server.openaiApiKey', openaiKey, vscode.ConfigurationTarget.Global);
        }

        const elevenLabsKey = await vscode.window.showInputBox({
            prompt: 'Enter your ElevenLabs API key (optional)',
            password: true,
            placeHolder: 'Leave empty to skip',
            value: this.config.get<string>('server.elevenLabsApiKey', '')
        });

        if (elevenLabsKey !== undefined) {
            await this.config.update('server.elevenLabsApiKey', elevenLabsKey, vscode.ConfigurationTarget.Global);
        }

        vscode.window.showInformationMessage('API keys configured successfully');
    }

    private async configureDatabases(): Promise<void> {
        // This would open a more complex configuration UI
        vscode.commands.executeCommand('workbench.action.openSettings', 'coachntt.server');
    }

    private async configureServerType(): Promise<void> {
        const choice = await vscode.window.showQuickPick([
            { label: '$(folder) Local Server', description: 'Run server from local files', value: 'local' },
            { label: '$(package) Docker Container', description: 'Run server in Docker', value: 'docker' },
            { label: '$(cloud) Remote Server', description: 'Connect to remote MCP server', value: 'remote' }
        ], {
            placeHolder: 'How do you want to run the MCP server?'
        });

        if (choice) {
            await this.context.workspaceState.update('coachntt.serverType', choice.value);
            vscode.window.showInformationMessage(`Server type set to: ${choice.label}`);
        }
    }
}