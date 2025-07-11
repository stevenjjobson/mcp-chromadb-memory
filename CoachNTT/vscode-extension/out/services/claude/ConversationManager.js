"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationManager = void 0;
const mcp_client_1 = require("../mcp-client");
class ConversationManager {
    constructor(context) {
        this.context = context;
        this.currentConversation = null;
        this.conversations = new Map();
        this.maxHistorySize = 50;
        this.loadConversations();
    }
    static getInstance(context) {
        if (!ConversationManager.instance) {
            ConversationManager.instance = new ConversationManager(context);
        }
        return ConversationManager.instance;
    }
    startNewConversation(title) {
        const conversation = {
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
    getCurrentConversation() {
        if (!this.currentConversation) {
            this.currentConversation = this.startNewConversation();
        }
        return this.currentConversation;
    }
    addMessage(message) {
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
    async getConversationContext() {
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
    async getRecentMemories() {
        try {
            const mcpClient = (0, mcp_client_1.getMCPClient)();
            if (!mcpClient.isConnected()) {
                return [];
            }
            const response = await mcpClient.callTool('recall_memories', {
                query: 'recent conversation context',
                limit: 5
            });
            return response?.memories || [];
        }
        catch (error) {
            console.error('Failed to get memories:', error);
            return [];
        }
    }
    getConversationHistory() {
        return Array.from(this.conversations.values())
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, this.maxHistorySize);
    }
    loadConversation(id) {
        const conversation = this.conversations.get(id);
        if (conversation) {
            this.currentConversation = conversation;
            return conversation;
        }
        return null;
    }
    deleteConversation(id) {
        this.conversations.delete(id);
        if (this.currentConversation?.id === id) {
            this.currentConversation = null;
        }
        this.saveConversations();
    }
    clearAllConversations() {
        this.conversations.clear();
        this.currentConversation = null;
        this.saveConversations();
    }
    generateId() {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateTitle(firstMessage) {
        // Simple title generation - take first 50 chars or until newline
        const title = firstMessage.split('\n')[0].substring(0, 50);
        return title.length < firstMessage.length ? title + '...' : title;
    }
    loadConversations() {
        try {
            const saved = this.context.globalState.get('coachntt.conversations');
            if (saved) {
                const data = JSON.parse(saved);
                data.forEach((conv) => {
                    conv.createdAt = new Date(conv.createdAt);
                    conv.updatedAt = new Date(conv.updatedAt);
                    this.conversations.set(conv.id, conv);
                });
            }
        }
        catch (error) {
            console.error('Failed to load conversations:', error);
        }
    }
    saveConversations() {
        try {
            const data = Array.from(this.conversations.values())
                .slice(0, this.maxHistorySize);
            this.context.globalState.update('coachntt.conversations', JSON.stringify(data));
        }
        catch (error) {
            console.error('Failed to save conversations:', error);
        }
    }
    exportConversation(conversation) {
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
exports.ConversationManager = ConversationManager;
//# sourceMappingURL=ConversationManager.js.map