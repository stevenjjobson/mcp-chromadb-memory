import * as vscode from 'vscode';
import { ConnectionManager } from './services/connection-manager';
import { getMCPClient, disposeMCPClient } from './services/mcp-client';
import { MemoryProvider } from './providers/memory-provider';
import { AudioController } from './services/audio-controller';

// This method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {
    console.log('CoachNTT extension is now active!');

    // Initialize services
    const connectionManager = new ConnectionManager(context);
    const mcpClient = getMCPClient();

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
            } catch (error) {
                vscode.window.showErrorMessage(`CoachNTT: Failed to store memory: ${error}`);
            }
        } else {
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

                if (!searchType) return;

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
                    } else {
                        // Show results in a quick pick
                        interface MemoryQuickPickItem extends vscode.QuickPickItem {
                            memory: any;
                        }
                        
                        const items: MemoryQuickPickItem[] = memories.map((m: any) => ({
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
            } catch (error) {
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
            
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Synthesizing audio...',
                    cancellable: false
                }, async () => {
                    const result = await mcpClient.synthesizeAudio(selectedText);
                    const response = JSON.parse(result.content?.[0]?.text || '{}');
                    
                    if (response.audio_url) {
                        vscode.window.showInformationMessage('Audio synthesized successfully!', 'Play')
                            .then(selection => {
                                if (selection === 'Play') {
                                    // TODO: Implement audio playback
                                    vscode.env.openExternal(vscode.Uri.parse(response.audio_url));
                                }
                            });
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(`CoachNTT: Audio synthesis failed: ${error}`);
            }
        } else {
            vscode.window.showInformationMessage('CoachNTT: Please select some text first');
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
        } catch (error) {
            vscode.window.showErrorMessage(`CoachNTT: Failed to get memory stats: ${error}`);
        }
    });

    // Register all disposables
    context.subscriptions.push(
        connectCommand,
        disconnectCommand,
        toggleConnectionCommand,
        configureServerCommand,
        storeMemoryCommand,
        searchMemoriesCommand,
        speakSelectionCommand,
        showMemoryStatsCommand
    );

    // Create memory provider for the tree view
    const memoryProvider = new MemoryProvider(mcpClient);
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
        const selection = await vscode.window.showInformationMessage(
            'CoachNTT extension activated. Would you like to connect to the MCP server?',
            'Connect',
            'Later'
        );
        
        if (selection === 'Connect') {
            await connectionManager.connect();
        }
    }
}

// This method is called when your extension is deactivated
export async function deactivate() {
    console.log('CoachNTT extension deactivating...');
    
    // Disconnect and dispose of MCP client
    disposeMCPClient();
    
    console.log('CoachNTT extension deactivated');
}

