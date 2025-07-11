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
exports.ClaudeClient = void 0;
const vscode = __importStar(require("vscode"));
class ClaudeClient {
    constructor(secretStorage) {
        this.secretStorage = secretStorage;
        this.apiKey = '';
        this.baseUrl = 'https://api.anthropic.com/v1';
        this.defaultModel = 'claude-3-opus-20240229';
    }
    static getInstance(secretStorage) {
        if (!ClaudeClient.instance) {
            ClaudeClient.instance = new ClaudeClient(secretStorage);
        }
        return ClaudeClient.instance;
    }
    async initialize() {
        try {
            // Try to get API key from secret storage
            this.apiKey = await this.secretStorage.get('coachntt.claudeApiKey') || '';
            if (!this.apiKey) {
                // If no key stored, prompt user
                const key = await vscode.window.showInputBox({
                    prompt: 'Enter your Claude API key',
                    placeHolder: 'sk-ant-...',
                    password: true,
                    ignoreFocusOut: true
                });
                if (key) {
                    await this.secretStorage.store('coachntt.claudeApiKey', key);
                    this.apiKey = key;
                    vscode.window.showInformationMessage('Claude API key saved securely');
                    return true;
                }
                else {
                    vscode.window.showWarningMessage('Claude API key is required for conversation features');
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            console.error('Failed to initialize Claude client:', error);
            vscode.window.showErrorMessage('Failed to initialize Claude client');
            return false;
        }
    }
    async clearApiKey() {
        await this.secretStorage.delete('coachntt.claudeApiKey');
        this.apiKey = '';
        vscode.window.showInformationMessage('Claude API key cleared');
    }
    hasApiKey() {
        return !!this.apiKey;
    }
    async *sendMessage(message, context, onError) {
        if (!this.apiKey) {
            const initialized = await this.initialize();
            if (!initialized) {
                throw new Error('Claude API key not configured');
            }
        }
        // Cancel any existing request
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        try {
            const systemPrompt = context.systemPrompt ||
                'You are CoachNTT, an AI assistant integrated into VSCode. You help developers understand and work with their codebase. ' +
                    'You have access to the user\'s memory system and can recall previous conversations and code context. ' +
                    'Provide clear, concise, and helpful responses. Use markdown formatting for code examples.';
            const response = await fetch(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.defaultModel,
                    system: systemPrompt,
                    messages: context.messages.map(msg => ({
                        role: msg.role,
                        content: msg.content
                    })),
                    stream: true,
                    max_tokens: 4096,
                    temperature: 0.7
                }),
                signal: this.abortController.signal
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Claude API error: ${response.status} - ${errorText}`);
            }
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                                yield parsed.delta.text;
                            }
                            else if (parsed.type === 'error') {
                                throw new Error(parsed.error.message);
                            }
                        }
                        catch (e) {
                            console.error('Failed to parse SSE data:', e);
                        }
                    }
                }
            }
        }
        catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request cancelled');
                return;
            }
            console.error('Claude API error:', error);
            if (onError) {
                onError(error);
            }
            else {
                throw error;
            }
        }
        finally {
            this.abortController = undefined;
        }
    }
    cancelRequest() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = undefined;
        }
    }
    async testConnection() {
        if (!this.apiKey) {
            return false;
        }
        try {
            const response = await fetch(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.defaultModel,
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 10
                })
            });
            return response.ok;
        }
        catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }
}
exports.ClaudeClient = ClaudeClient;
//# sourceMappingURL=ClaudeClient.js.map