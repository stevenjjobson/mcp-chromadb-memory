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
exports.ConnectionManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const mcp_client_1 = require("./mcp-client");
class ConnectionManager {
    constructor(context) {
        this.context = context;
        this.config = vscode.workspace.getConfiguration('coachntt');
    }
    /**
     * Get the server configuration from VSCode settings
     */
    getServerConfig() {
        const host = this.config.get('server.host', 'localhost');
        const port = this.config.get('server.port', 3000);
        const apiKey = this.config.get('server.apiKey', '');
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
    findLocalServer() {
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
    isDockerAvailable() {
        try {
            const { execSync } = require('child_process');
            execSync('docker --version', { stdio: 'ignore' });
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get environment variables for the MCP server
     */
    getEnvironmentVariables() {
        const env = {};
        // Get API keys from settings or environment
        const openaiKey = this.config.get('server.openaiApiKey') || process.env.OPENAI_API_KEY;
        const elevenLabsKey = this.config.get('server.elevenLabsApiKey') || process.env.ELEVENLABS_API_KEY;
        if (openaiKey)
            env.OPENAI_API_KEY = openaiKey;
        if (elevenLabsKey)
            env.ELEVENLABS_API_KEY = elevenLabsKey;
        // ChromaDB configuration
        env.CHROMA_HOST = this.config.get('server.chromaHost', 'localhost');
        env.CHROMA_PORT = this.config.get('server.chromaPort', '8000');
        // PostgreSQL configuration
        env.POSTGRES_HOST = this.config.get('server.postgresHost', 'localhost');
        env.POSTGRES_PORT = this.config.get('server.postgresPort', '5432');
        env.POSTGRES_DB = this.config.get('server.postgresDb', 'memory_db');
        env.POSTGRES_USER = this.config.get('server.postgresUser', 'postgres');
        env.POSTGRES_PASSWORD = this.config.get('server.postgresPassword', 'postgres');
        // Hybrid storage configuration
        env.USE_HYBRID_STORAGE = 'true';
        env.ENABLE_DUAL_WRITE = 'true';
        env.POSTGRES_READ_RATIO = '0.5';
        // Session logging
        env.AUTO_START_SESSION_LOGGING = String(this.config.get('session.autoStart', true));
        env.SESSION_LOGGING_PROJECT_NAME = this.config.get('session.projectName', 'CoachNTT VSCode');
        // Code intelligence
        env.CODE_INDEXING_ENABLED = String(this.config.get('codeIntelligence.enabled', true));
        return env;
    }
    /**
     * Build the MCP client configuration
     */
    async buildMCPConfig(serverConfig) {
        switch (serverConfig.type) {
            case 'local':
                return {
                    serverPath: 'node',
                    serverArgs: [serverConfig.localPath],
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
                        serverConfig.dockerImage
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
    async connect() {
        const mcpClient = (0, mcp_client_1.getMCPClient)();
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
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to connect: ${error}`);
            throw error;
        }
    }
    /**
     * Disconnect from the MCP server
     */
    async disconnect() {
        const mcpClient = (0, mcp_client_1.getMCPClient)();
        if (!mcpClient.isConnected()) {
            vscode.window.showInformationMessage('Not connected to CoachNTT MCP server');
            return;
        }
        try {
            await mcpClient.disconnect();
            await this.context.workspaceState.update('coachntt.connected', false);
            vscode.window.showInformationMessage('Disconnected from CoachNTT MCP server');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to disconnect: ${error}`);
            throw error;
        }
    }
    /**
     * Toggle connection state
     */
    async toggleConnection() {
        const mcpClient = (0, mcp_client_1.getMCPClient)();
        if (mcpClient.isConnected()) {
            await this.disconnect();
        }
        else {
            await this.connect();
        }
    }
    /**
     * Auto-connect if enabled
     */
    async autoConnect() {
        const autoConnect = this.config.get('server.autoConnect', true);
        const wasConnected = this.context.workspaceState.get('coachntt.connected', false);
        if (autoConnect || wasConnected) {
            try {
                await this.connect();
            }
            catch (error) {
                console.error('Auto-connect failed:', error);
                // Don't show error message for auto-connect failures
            }
        }
    }
    /**
     * Configure server settings
     */
    async configureServer() {
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
    async configureApiKeys() {
        const openaiKey = await vscode.window.showInputBox({
            prompt: 'Enter your OpenAI API key',
            password: true,
            placeHolder: 'sk-...',
            value: this.config.get('server.openaiApiKey', '')
        });
        if (openaiKey !== undefined) {
            await this.config.update('server.openaiApiKey', openaiKey, vscode.ConfigurationTarget.Global);
        }
        const elevenLabsKey = await vscode.window.showInputBox({
            prompt: 'Enter your ElevenLabs API key (optional)',
            password: true,
            placeHolder: 'Leave empty to skip',
            value: this.config.get('server.elevenLabsApiKey', '')
        });
        if (elevenLabsKey !== undefined) {
            await this.config.update('server.elevenLabsApiKey', elevenLabsKey, vscode.ConfigurationTarget.Global);
        }
        vscode.window.showInformationMessage('API keys configured successfully');
    }
    async configureDatabases() {
        // This would open a more complex configuration UI
        vscode.commands.executeCommand('workbench.action.openSettings', 'coachntt.server');
    }
    async configureServerType() {
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
exports.ConnectionManager = ConnectionManager;
//# sourceMappingURL=connection-manager.js.map