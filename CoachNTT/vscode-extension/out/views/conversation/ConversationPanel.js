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
exports.ConversationPanel = void 0;
const vscode = __importStar(require("vscode"));
const ClaudeClient_1 = require("../../services/claude/ClaudeClient");
const ConversationManager_1 = require("../../services/claude/ConversationManager");
const StreamHandler_1 = require("../../services/claude/StreamHandler");
class ConversationPanel {
    static createOrShow(extensionUri, context) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If we already have a panel, show it
        if (ConversationPanel.currentPanel) {
            ConversationPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel('coachntt.conversation', 'CoachNTT Chat', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'node_modules')
            ]
        });
        ConversationPanel.currentPanel = new ConversationPanel(panel, extensionUri, context);
    }
    constructor(panel, extensionUri, context) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        // Initialize services
        this.claudeClient = ClaudeClient_1.ClaudeClient.getInstance(context.secrets);
        this.conversationManager = ConversationManager_1.ConversationManager.getInstance(context);
        this.streamHandler = new StreamHandler_1.StreamHandler();
        // Set the webview's initial html content
        this._update();
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Update the content based on view changes
        this._panel.onDidChangeViewState(e => {
            if (this._panel.visible) {
                this._update();
            }
        }, null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'sendMessage':
                    this._handleUserMessage(message.text);
                    break;
                case 'playAudio':
                    this._handleAudioPlayback(message.audioData, message.mimeType);
                    break;
                case 'ready':
                    this._onWebviewReady();
                    break;
            }
        }, null, this._disposables);
    }
    dispose() {
        ConversationPanel.currentPanel = undefined;
        // Clean up our resources
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    sendMessage(message) {
        // Send message to webview
        this._panel.webview.postMessage(message);
    }
    async _handleUserMessage(text) {
        // Add user message to UI and conversation
        this.sendMessage({
            type: 'message',
            role: 'user',
            content: text,
            timestamp: new Date().toISOString()
        });
        // Add to conversation history
        this.conversationManager.addMessage({
            role: 'user',
            content: text
        });
        // Check if Claude is initialized
        if (!this.claudeClient.hasApiKey()) {
            const initialized = await this.claudeClient.initialize();
            if (!initialized) {
                this.sendMessage({
                    type: 'message',
                    role: 'assistant',
                    content: 'Please configure your Claude API key to start chatting.',
                    timestamp: new Date().toISOString()
                });
                return;
            }
        }
        try {
            // Start streaming
            this.streamHandler.startStream();
            this.sendMessage({ type: 'streamStart' });
            // Get conversation context
            const context = await this.conversationManager.getConversationContext();
            // Stream response from Claude
            let messageId = Date.now().toString();
            let fullResponse = '';
            for await (const chunk of this.claudeClient.sendMessage(text, context)) {
                fullResponse += chunk;
                this.streamHandler.addChunk(chunk);
                // Send streaming chunk to UI
                this.sendMessage({
                    type: 'streamChunk',
                    id: messageId,
                    content: fullResponse
                });
            }
            // End streaming
            this.streamHandler.endStream();
            this.sendMessage({ type: 'streamEnd' });
            // Add complete response to conversation
            this.conversationManager.addMessage({
                role: 'assistant',
                content: fullResponse
            });
            // Send final message
            this.sendMessage({
                type: 'message',
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            console.error('Error sending message to Claude:', error);
            this.sendMessage({ type: 'streamEnd' });
            this.sendMessage({
                type: 'message',
                role: 'assistant',
                content: `Error: ${error.message || 'Failed to get response from Claude'}`,
                timestamp: new Date().toISOString()
            });
        }
    }
    async _handleAudioPlayback(audioData, mimeType) {
        // Send audio data to webview for playback
        this.sendMessage({
            type: 'playAudio',
            audioData: audioData,
            mimeType: mimeType
        });
    }
    _onWebviewReady() {
        // Called when webview is fully loaded
        this.sendMessage({
            type: 'initialize',
            theme: vscode.window.activeColorTheme.kind
        });
    }
    _update() {
        const webview = this._panel.webview;
        this._panel.title = 'CoachNTT Chat';
        this._panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'resources', 'icon.png');
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    _getHtmlForWebview(webview) {
        // Get resource URIs
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'conversation.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'styles', 'conversation.css'));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
        // Use a nonce to only allow scripts that we trust
        const nonce = getNonce();
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <link href="${styleUri}" rel="stylesheet">
                <link href="${codiconsUri}" rel="stylesheet">
                <title>CoachNTT Chat</title>
            </head>
            <body>
                <div id="conversation-container">
                    <div id="messages-container">
                        <div id="messages"></div>
                    </div>
                    <div id="input-container">
                        <div id="input-wrapper">
                            <textarea 
                                id="message-input" 
                                placeholder="Type your message..."
                                rows="1"
                            ></textarea>
                            <button id="send-button" class="codicon codicon-send" title="Send message"></button>
                        </div>
                        <div id="input-actions">
                            <button id="clear-button" class="codicon codicon-clear-all" title="Clear conversation"></button>
                            <button id="export-button" class="codicon codicon-export" title="Export conversation"></button>
                            <button id="settings-button" class="codicon codicon-settings-gear" title="Settings"></button>
                        </div>
                    </div>
                    <div id="audio-player" style="display: none;">
                        <audio id="audio-element" controls></audio>
                        <div id="audio-queue"></div>
                    </div>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
exports.ConversationPanel = ConversationPanel;
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=ConversationPanel.js.map