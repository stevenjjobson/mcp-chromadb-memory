import * as vscode from 'vscode';
import { Message, ConversationContext } from './ClaudeClient';
import { getMCPClient } from '../mcp-client';

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, any>;
}

export class ConversationManager {
    private static instance: ConversationManager;
    private currentConversation: Conversation | null = null;
    private conversations: Map<string, Conversation> = new Map();
    private readonly maxHistorySize = 50;

    private constructor(private context: vscode.ExtensionContext) {
        this.loadConversations();
    }

    public static getInstance(context: vscode.ExtensionContext): ConversationManager {
        if (!ConversationManager.instance) {
            ConversationManager.instance = new ConversationManager(context);
        }
        return ConversationManager.instance;
    }

    public startNewConversation(title?: string): Conversation {
        const conversation: Conversation = {
            id: this.generateId(),
            title: title || `Conversation ${new Date().toLocaleString()}`,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.currentConversation = conversation;
        this.conversations.set(conversation.id, conversation);
        this.saveConversations();

        return conversation;
    }

    public getCurrentConversation(): Conversation | null {
        if (!this.currentConversation) {
            this.currentConversation = this.startNewConversation();
        }
        return this.currentConversation;
    }

    public addMessage(message: Message): void {
        const conversation = this.getCurrentConversation();
        if (conversation) {
            conversation.messages.push(message);
            conversation.updatedAt = new Date();
            
            // Update title if it's the first user message
            if (conversation.messages.length === 1 && message.role === 'user') {
                conversation.title = this.generateTitle(message.content);
            }

            this.saveConversations();
        }
    }

    public async getConversationContext(): Promise<ConversationContext> {
        const conversation = this.getCurrentConversation();
        if (!conversation) {
            return { messages: [] };
        }

        // Get recent memories to enhance context
        const memories = await this.getRecentMemories();
        
        let systemPrompt = 'You are CoachNTT, an AI assistant integrated into VSCode. ';
        
        if (memories.length > 0) {
            systemPrompt += '\n\nRelevant memories from previous sessions:\n';
            memories.forEach(memory => {
                systemPrompt += `- ${memory.content}\n`;
            });
        }

        // Limit conversation history to prevent token overflow
        const recentMessages = conversation.messages.slice(-20);

        return {
            messages: recentMessages,
            systemPrompt
        };
    }

    private async getRecentMemories(): Promise<any[]> {
        try {
            const mcpClient = getMCPClient();
            if (!mcpClient.isConnected()) {
                return [];
            }

            const response = await mcpClient.callTool('recall_memories', {
                query: 'recent conversation context',
                limit: 5
            });

            return (response?.memories as any[]) || [];
        } catch (error) {
            console.error('Failed to get memories:', error);
            return [];
        }
    }

    public getConversationHistory(): Conversation[] {
        return Array.from(this.conversations.values())
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, this.maxHistorySize);
    }

    public loadConversation(id: string): Conversation | null {
        const conversation = this.conversations.get(id);
        if (conversation) {
            this.currentConversation = conversation;
            return conversation;
        }
        return null;
    }

    public deleteConversation(id: string): void {
        this.conversations.delete(id);
        if (this.currentConversation?.id === id) {
            this.currentConversation = null;
        }
        this.saveConversations();
    }

    public clearAllConversations(): void {
        this.conversations.clear();
        this.currentConversation = null;
        this.saveConversations();
    }

    private generateId(): string {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateTitle(firstMessage: string): string {
        // Simple title generation - take first 50 chars or until newline
        const title = firstMessage.split('\n')[0].substring(0, 50);
        return title.length < firstMessage.length ? title + '...' : title;
    }

    private loadConversations(): void {
        try {
            const saved = this.context.globalState.get<string>('coachntt.conversations');
            if (saved) {
                const data = JSON.parse(saved);
                data.forEach((conv: any) => {
                    conv.createdAt = new Date(conv.createdAt);
                    conv.updatedAt = new Date(conv.updatedAt);
                    this.conversations.set(conv.id, conv);
                });
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
        }
    }

    private saveConversations(): void {
        try {
            const data = Array.from(this.conversations.values())
                .slice(0, this.maxHistorySize);
            
            this.context.globalState.update(
                'coachntt.conversations',
                JSON.stringify(data)
            );
        } catch (error) {
            console.error('Failed to save conversations:', error);
        }
    }

    public exportConversation(conversation: Conversation): string {
        let markdown = `# ${conversation.title}\n\n`;
        markdown += `Created: ${conversation.createdAt.toLocaleString()}\n`;
        markdown += `Updated: ${conversation.updatedAt.toLocaleString()}\n\n`;
        markdown += '---\n\n';

        conversation.messages.forEach(msg => {
            markdown += `## ${msg.role === 'user' ? '👤 User' : '🤖 Assistant'}\n\n`;
            markdown += `${msg.content}\n\n`;
        });

        return markdown;
    }
}