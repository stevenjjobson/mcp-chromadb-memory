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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const connection_manager_1 = require("./services/connection-manager");
const mcp_client_1 = require("./services/mcp-client");
const memory_provider_1 = require("./providers/memory-provider");
const audio_controller_1 = require("./services/audio-controller");
const ConversationPanel_1 = require("./views/conversation/ConversationPanel");
const ClaudeClient_1 = require("./services/claude/ClaudeClient");
// This method is called when your extension is activated
async function activate(context) {
    console.log('CoachNTT extension is now active!');
    // Initialize services
    const connectionManager = new connection_manager_1.ConnectionManager(context);
    const mcpClient = (0, mcp_client_1.getMCPClient)();
    const audioController = new audio_controller_1.AudioController(mcpClient, context.extensionUri);
    // Register connect command
    const connectCommand = vscode.commands.registerCommand('coachntt.connect', async () => {
        await connectionManager.connect();
    });
    // Register disconnect command
    const disconnectCommand = vscode.commands.registerCommand('coachntt.disconnect', async () => {
        await connectionManager.disconnect();
    });
    // Register toggle connection command
    const toggleConnectionCommand = vscode.commands.registerCommand('coachntt.toggleConnection', async () => {
        await connectionManager.toggleConnection();
    });
    // Register configure server command
    const configureServerCommand = vscode.commands.registerCommand('coachntt.configureServer', async () => {
        await connectionManager.configureServer();
    });
    // Register open conversation command
    const openConversationCommand = vscode.commands.registerCommand('coachntt.openConversation', () => {
        ConversationPanel_1.ConversationPanel.createOrShow(context.extensionUri, context);
    });
    // Register clear Claude API key command
    const clearClaudeApiKeyCommand = vscode.commands.registerCommand('coachntt.clearClaudeApiKey', async () => {
        const claudeClient = ClaudeClient_1.ClaudeClient.getInstance(context.secrets);
        await claudeClient.clearApiKey();
    });
    const storeMemoryCommand = vscode.commands.registerCommand('coachntt.storeMemory', async () => {
        if (!mcpClient.isConnected()) {
            vscode.window.showErrorMessage('CoachNTT: Not connected to server. Please connect first.');
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.selection) {
            const selectedText = editor.document.getText(editor.selection);
            const metadata = {
                file: editor.document.fileName,
                language: editor.document.languageId,
                line: editor.selection.start.line + 1
            };
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Storing memory...',
                    cancellable: false
                }, async () => {
                    const result = await mcpClient.storeMemory(selectedText, metadata);
                    const content = result.content?.[0]?.text || 'Memory stored';
                    vscode.window.showInformationMessage(`CoachNTT: ${content}`);
                });
            }
            catch (error) {
                vscode.window.showErrorMessage(`CoachNTT: Failed to store memory: ${error}`);
            }
        }
        else {
            vscode.window.showInformationMessage('CoachNTT: Please select some text first');
        }
    });
    const searchMemoriesCommand = vscode.commands.registerCommand('coachntt.searchMemories', async () => {
        if (!mcpClient.isConnected()) {
            vscode.window.showErrorMessage('CoachNTT: Not connected to server. Please connect first.');
            return;
        }
        const query = await vscode.window.showInputBox({
            prompt: 'Search memories',
            placeHolder: 'Enter search query...'
        });
        if (query) {
            try {
                const searchType = await vscode.window.showQuickPick([
                    { label: 'Hybrid Search', description: 'Combine exact and semantic search', value: 'hybrid' },
                    { label: 'Semantic Search', description: 'Search by meaning', value: 'semantic' },
                    { label: 'Exact Search', description: 'Search for exact matches', value: 'exact' }
                ], {
                    placeHolder: 'Select search type'
                });
                if (!searchType)
                    return;
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Searching memories for "${query}"...`,
                    cancellable: false
                }, async () => {
                    let result;
                    switch (searchType.value) {
                        case 'hybrid':
                            result = await mcpClient.searchHybrid(query, 0.4, 10);
                            break;
                        case 'exact':
                            result = await mcpClient.searchExact(query, undefined, 10);
                            break;
                        default:
                            result = await mcpClient.recallMemories(query, 10);
                    }
                    const memories = JSON.parse(result.content?.[0]?.text || '[]');
                    if (memories.length === 0) {
                        vscode.window.showInformationMessage('No memories found');
                    }
                    else {
                        const items = memories.map((m) => ({
                            label: m.content.substring(0, 60) + '...',
                            description: `Score: ${m.score?.toFixed(3) || 'N/A'}`,
                            detail: m.metadata ? JSON.stringify(m.metadata) : undefined,
                            memory: m
                        }));
                        const selected = await vscode.window.showQuickPick(items, {
                            placeHolder: `Found ${memories.length} memories`
                        });
                        if (selected) {
                            // Show full memory in output channel
                            const outputChannel = mcpClient.getOutputChannel();
                            outputChannel.clear();
                            outputChannel.appendLine('=== Memory Details ===');
                            outputChannel.appendLine(`Content: ${selected.memory.content}`);
                            outputChannel.appendLine(`Score: ${selected.memory.score}`);
                            outputChannel.appendLine(`Metadata: ${JSON.stringify(selected.memory.metadata, null, 2)}`);
                            outputChannel.show();
                        }
                    }
                });
            }
            catch (error) {
                vscode.window.showErrorMessage(`CoachNTT: Search failed: ${error}`);
            }
        }
    });
    const speakSelectionCommand = vscode.commands.registerCommand('coachntt.audio.speakSelection', async () => {
        if (!mcpClient.isConnected()) {
            vscode.window.showErrorMessage('CoachNTT: Not connected to server. Please connect first.');
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.selection) {
            const selectedText = editor.document.getText(editor.selection);
            if (!selectedText) {
                vscode.window.showInformationMessage('CoachNTT: Please select some text first');
                return;
            }
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Synthesizing audio...',
                    cancellable: false
                }, async () => {
                    await audioController.synthesizeAndPlay(selectedText);
                });
            }
            catch (error) {
                vscode.window.showErrorMessage(`CoachNTT: Audio synthesis failed: ${error}`);
            }
        }
        else {
            vscode.window.showInformationMessage('CoachNTT: Please select some text first');
        }
    });
    // Audio control commands
    const togglePlaybackCommand = vscode.commands.registerCommand('coachntt.audio.togglePlayback', () => {
        audioController.togglePlayPause();
    });
    const showAudioControlsCommand = vscode.commands.registerCommand('coachntt.audio.showControls', () => {
        audioController.showControls();
    });
    const configureVoiceCommand = vscode.commands.registerCommand('coachntt.audio.configureVoice', async () => {
        try {
            const voices = await audioController.getAvailableVoices();
            const voiceItems = voices.map(voice => ({
                label: voice.name,
                description: voice.labels ? Object.values(voice.labels).join(', ') : '',
                voiceId: voice.voice_id
            }));
            const selected = await vscode.window.showQuickPick(voiceItems, {
                placeHolder: 'Select a voice for audio synthesis'
            });
            if (selected) {
                const config = vscode.workspace.getConfiguration('coachntt');
                await config.update('audio.defaultVoice', selected.voiceId, true);
                vscode.window.showInformationMessage(`Voice set to: ${selected.label}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to configure voice: ${error}`);
        }
    });
    // Add memory stats command
    const showMemoryStatsCommand = vscode.commands.registerCommand('coachntt.showMemoryStats', async () => {
        if (!mcpClient.isConnected()) {
            vscode.window.showErrorMessage('CoachNTT: Not connected to server. Please connect first.');
            return;
        }
        try {
            const statsResult = await mcpClient.getMemoryStats();
            const stats = JSON.parse(statsResult.content?.[0]?.text || '{}');
            const tierStatsResult = await mcpClient.getTierStats();
            const tierStats = JSON.parse(tierStatsResult.content?.[0]?.text || '{}');
            const outputChannel = mcpClient.getOutputChannel();
            outputChannel.clear();
            outputChannel.appendLine('=== Memory Statistics ===');
            outputChannel.appendLine(`Total Memories: ${stats.total_memories || 0}`);
            outputChannel.appendLine(`Average Importance: ${stats.average_importance?.toFixed(3) || 'N/A'}`);
            outputChannel.appendLine(`\n=== Tier Distribution ===`);
            outputChannel.appendLine(`Working Tier: ${tierStats.working_tier?.count || 0} memories`);
            outputChannel.appendLine(`Session Tier: ${tierStats.session_tier?.count || 0} memories`);
            outputChannel.appendLine(`Long-term Tier: ${tierStats.long_term_tier?.count || 0} memories`);
            outputChannel.show();
        }
        catch (error) {
            vscode.window.showErrorMessage(`CoachNTT: Failed to get memory stats: ${error}`);
        }
    });
    // Register all disposables
    context.subscriptions.push(connectCommand, disconnectCommand, toggleConnectionCommand, configureServerCommand, openConversationCommand, clearClaudeApiKeyCommand, storeMemoryCommand, searchMemoriesCommand, speakSelectionCommand, togglePlaybackCommand, showAudioControlsCommand, configureVoiceCommand, showMemoryStatsCommand, audioController);
    // Create memory provider for the tree view
    const memoryProvider = new memory_provider_1.MemoryProvider(mcpClient);
    const memoryTreeProvider = vscode.window.createTreeView('coachntt.memories', {
        treeDataProvider: memoryProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(memoryTreeProvider);
    // Set up refresh command for memory view
    const refreshMemoriesCommand = vscode.commands.registerCommand('coachntt.refreshMemories', () => {
        memoryProvider.refresh();
    });
    context.subscriptions.push(refreshMemoriesCommand);
    // Auto-connect if enabled
    await connectionManager.autoConnect();
    // Show activation message only if not auto-connected
    if (!mcpClient.isConnected()) {
        const selection = await vscode.window.showInformationMessage('CoachNTT extension activated. Would you like to connect to the MCP server?', 'Connect', 'Later');
        if (selection === 'Connect') {
            await connectionManager.connect();
        }
    }
}
// This method is called when your extension is deactivated
async function deactivate() {
    console.log('CoachNTT extension deactivating...');
    // Disconnect and dispose of MCP client
    (0, mcp_client_1.disposeMCPClient)();
    console.log('CoachNTT extension deactivated');
}
//# sourceMappingURL=extension.js.map