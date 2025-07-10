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
exports.MemoryItem = exports.MemoryProvider = void 0;
const vscode = __importStar(require("vscode"));
class MemoryProvider {
    constructor(mcpClient) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.tierStats = null;
        this.memories = new Map();
        this.mcpClient = mcpClient;
        // Auto-refresh when connection state changes
        setInterval(() => this.refresh(), 30000); // Refresh every 30 seconds
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!this.mcpClient.isConnected()) {
            return [new MemoryItem('Not connected', 'Click to connect', vscode.TreeItemCollapsibleState.None, 'disconnected')];
        }
        if (!element) {
            // Root level - show tiers
            try {
                const result = await this.mcpClient.getTierStats();
                this.tierStats = JSON.parse(result.content?.[0]?.text || '{}');
                const items = [];
                if (this.tierStats.working_tier) {
                    items.push(new MemoryItem('Working Tier (48h)', `${this.tierStats.working_tier.count || 0} items`, vscode.TreeItemCollapsibleState.Collapsed, 'working'));
                }
                if (this.tierStats.session_tier) {
                    items.push(new MemoryItem('Session Tier (14d)', `${this.tierStats.session_tier.count || 0} items`, vscode.TreeItemCollapsibleState.Collapsed, 'session'));
                }
                if (this.tierStats.long_term_tier) {
                    items.push(new MemoryItem('Long-term Tier', `${this.tierStats.long_term_tier.count || 0} items`, vscode.TreeItemCollapsibleState.Collapsed, 'long_term'));
                }
                return items;
            }
            catch (error) {
                console.error('Failed to get tier stats:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                return [new MemoryItem('Error loading tiers', errorMessage, vscode.TreeItemCollapsibleState.None, 'error')];
            }
        }
        else {
            // Get memories for specific tier
            const tier = element.tier;
            if (!tier)
                return [];
            try {
                // Check cache first
                if (this.memories.has(tier)) {
                    return this.formatMemories(this.memories.get(tier));
                }
                // Fetch memories for this tier
                const result = await this.mcpClient.recallMemories(`tier:${tier}`, 50);
                const memories = JSON.parse(result.content?.[0]?.text || '[]');
                // Cache the results
                this.memories.set(tier, memories);
                return this.formatMemories(memories);
            }
            catch (error) {
                console.error(`Failed to get memories for tier ${tier}:`, error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                return [new MemoryItem('Error loading memories', errorMessage, vscode.TreeItemCollapsibleState.None, 'error')];
            }
        }
    }
    formatMemories(memories) {
        return memories.map(memory => {
            const content = memory.content || 'No content';
            const label = content.length > 60 ? content.substring(0, 60) + '...' : content;
            const timestamp = memory.metadata?.timestamp ? new Date(memory.metadata.timestamp).toLocaleString() : 'Unknown time';
            const importance = memory.metadata?.importance ? `Importance: ${memory.metadata.importance.toFixed(2)}` : '';
            const item = new MemoryItem(label, timestamp, vscode.TreeItemCollapsibleState.None, 'memory');
            item.tooltip = new vscode.MarkdownString();
            item.tooltip.appendText(`**Content:** ${content}\n\n`);
            item.tooltip.appendText(`**Time:** ${timestamp}\n\n`);
            if (importance) {
                item.tooltip.appendText(`**${importance}**\n\n`);
            }
            if (memory.metadata) {
                item.tooltip.appendCodeblock(JSON.stringify(memory.metadata, null, 2), 'json');
            }
            item.contextValue = 'memory';
            item.memoryData = memory;
            return item;
        });
    }
    refresh() {
        // Clear cache
        this.memories.clear();
        this.tierStats = null;
        this._onDidChangeTreeData.fire();
    }
    getMemoryItem(memoryId) {
        for (const [tier, memories] of this.memories) {
            const memory = memories.find(m => m.id === memoryId);
            if (memory)
                return memory;
        }
        return undefined;
    }
}
exports.MemoryProvider = MemoryProvider;
class MemoryItem extends vscode.TreeItem {
    constructor(label, description, collapsibleState, tier, memoryData) {
        super(label, collapsibleState);
        this.label = label;
        this.description = description;
        this.collapsibleState = collapsibleState;
        this.tier = tier;
        this.memoryData = memoryData;
        this.tooltip = `${this.label} - ${this.description}`;
        this.description = description;
        // Set icon and context based on type
        if (tier === 'disconnected') {
            this.iconPath = new vscode.ThemeIcon('debug-disconnect');
            this.command = {
                command: 'coachntt.connect',
                title: 'Connect to Server',
                arguments: []
            };
        }
        else if (tier === 'error') {
            this.iconPath = new vscode.ThemeIcon('error');
        }
        else if (tier === 'working' || tier === 'session' || tier === 'long_term') {
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'tier';
        }
        else if (tier === 'memory') {
            this.iconPath = new vscode.ThemeIcon('file-text');
            this.contextValue = 'memory';
        }
    }
}
exports.MemoryItem = MemoryItem;
//# sourceMappingURL=memory-provider.js.map