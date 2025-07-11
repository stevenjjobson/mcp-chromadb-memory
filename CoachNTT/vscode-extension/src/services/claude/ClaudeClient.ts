import * as vscode from 'vscode';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface ConversationContext {
    messages: Message[];
    systemPrompt?: string;
}

export interface ClaudeConfig {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}

export class ClaudeClient {
    private static instance: ClaudeClient;
    private apiKey: string = '';
    private readonly baseUrl = 'https://api.anthropic.com/v1';
    private readonly defaultModel = 'claude-3-opus-20240229';
    private abortController?: AbortController;

    constructor(private secretStorage: vscode.SecretStorage) {}

    public static getInstance(secretStorage: vscode.SecretStorage): ClaudeClient {
        if (!ClaudeClient.instance) {
            ClaudeClient.instance = new ClaudeClient(secretStorage);
        }
        return ClaudeClient.instance;
    }

    public async initialize(): Promise<boolean> {
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
                } else {
                    vscode.window.showWarningMessage('Claude API key is required for conversation features');
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('Failed to initialize Claude client:', error);
            vscode.window.showErrorMessage('Failed to initialize Claude client');
            return false;
        }
    }

    public async clearApiKey(): Promise<void> {
        await this.secretStorage.delete('coachntt.claudeApiKey');
        this.apiKey = '';
        vscode.window.showInformationMessage('Claude API key cleared');
    }

    public hasApiKey(): boolean {
        return !!this.apiKey;
    }

    public async *sendMessage(
        message: string,
        context: ConversationContext,
        onError?: (error: Error) => void
    ): AsyncGenerator<string> {
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
                if (done) break;

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
                            } else if (parsed.type === 'error') {
                                throw new Error(parsed.error.message);
                            }
                        } catch (e) {
                            console.error('Failed to parse SSE data:', e);
                        }
                    }
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Request cancelled');
                return;
            }

            console.error('Claude API error:', error);
            if (onError) {
                onError(error);
            } else {
                throw error;
            }
        } finally {
            this.abortController = undefined;
        }
    }

    public cancelRequest(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = undefined;
        }
    }

    public async testConnection(): Promise<boolean> {
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
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }
}