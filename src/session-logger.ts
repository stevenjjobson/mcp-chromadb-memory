import { ObsidianManager } from './obsidian-manager.js';
import { config } from './config.js';
import path from 'path';

interface SessionEntry {
  timestamp: string;
  type: 'user' | 'assistant' | 'tool' | 'result';
  content: string;
  toolName?: string;
  codeSnippet?: string;
  filePath?: string;
}

interface SessionSummary {
  startTime: Date;
  endTime: Date;
  project: string;
  mainTopics: string[];
  toolsUsed: Set<string>;
  filesModified: Set<string>;
  filesCreated: Set<string>;
  codeSnippets: Array<{ language: string; code: string; description: string }>;
  decisions: string[];
  achievements: string[];
}

export class SessionLogger {
  private obsidianManager: ObsidianManager;
  private sessionEntries: SessionEntry[] = [];
  private sessionSummary: SessionSummary;
  private sessionId: string;
  private autoSave: boolean = true;
  private sessionFolder: string = 'Sessions';
  
  constructor(obsidianManager: ObsidianManager, project: string = 'Unknown Project') {
    this.obsidianManager = obsidianManager;
    this.sessionId = this.generateSessionId();
    this.sessionSummary = {
      startTime: new Date(),
      endTime: new Date(),
      project,
      mainTopics: [],
      toolsUsed: new Set(),
      filesModified: new Set(),
      filesCreated: new Set(),
      codeSnippets: [],
      decisions: [],
      achievements: []
    };
  }
  
  private generateSessionId(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getHours()}${now.getMinutes()}`;
  }
  
  // Log a user message
  logUserMessage(content: string) {
    this.sessionEntries.push({
      timestamp: new Date().toISOString(),
      type: 'user',
      content
    });
    
    // Extract topics from user message
    this.extractTopics(content);
  }
  
  // Log an assistant response
  logAssistantMessage(content: string) {
    this.sessionEntries.push({
      timestamp: new Date().toISOString(),
      type: 'assistant',
      content
    });
    
    // Extract decisions and achievements
    this.extractDecisionsAndAchievements(content);
  }
  
  // Log tool usage
  logToolUse(toolName: string, args: any, result?: any) {
    this.sessionEntries.push({
      timestamp: new Date().toISOString(),
      type: 'tool',
      content: JSON.stringify(args, null, 2),
      toolName
    });
    
    this.sessionSummary.toolsUsed.add(toolName);
    
    // Track file operations
    if (toolName === 'Write' || toolName === 'MultiEdit') {
      const filePath = args.file_path || args.filePath;
      if (filePath) {
        if (toolName === 'Write' && result?.includes('created successfully')) {
          this.sessionSummary.filesCreated.add(filePath);
        } else {
          this.sessionSummary.filesModified.add(filePath);
        }
      }
    }
    
    // Track code changes
    if ((toolName === 'Edit' || toolName === 'MultiEdit') && args.new_string) {
      this.addCodeSnippet(args.file_path, args.new_string);
    }
  }
  
  // Add a code snippet to the session
  private addCodeSnippet(filePath: string, code: string) {
    const ext = path.extname(filePath).slice(1) || 'text';
    const description = `Modified ${path.basename(filePath)}`;
    
    // Only keep significant snippets (more than 5 lines)
    if (code.split('\n').length > 5) {
      this.sessionSummary.codeSnippets.push({
        language: ext,
        code: code.substring(0, 500), // Limit snippet length
        description
      });
    }
  }
  
  // Extract topics from conversation
  private extractTopics(text: string) {
    const topicPatterns = [
      /(?:about|regarding|concerning|for)\s+(\w+[\w\s-]*)/gi,
      /(?:implement|create|build|fix|add)\s+(\w+[\w\s-]*)/gi,
      /(?:obsidian|docker|chromadb|mcp|memory|vault|api)/gi
    ];
    
    topicPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const topic = match[1] || match[0];
        if (topic && topic.length > 3) {
          this.sessionSummary.mainTopics.push(topic.trim());
        }
      }
    });
  }
  
  // Extract decisions and achievements from assistant responses
  private extractDecisionsAndAchievements(text: string) {
    // Look for decision indicators
    if (text.match(/decided to|chose|will use|going with/i)) {
      const lines = text.split('\n');
      lines.forEach(line => {
        if (line.match(/decided to|chose|will use|going with/i)) {
          this.sessionSummary.decisions.push(line.trim());
        }
      });
    }
    
    // Look for achievement indicators
    if (text.match(/successfully|completed|fixed|implemented|created/i)) {
      const lines = text.split('\n');
      lines.forEach(line => {
        if (line.match(/successfully|completed|fixed|implemented|created/i) && line.length > 20) {
          this.sessionSummary.achievements.push(line.trim());
        }
      });
    }
  }
  
  // Generate the Obsidian note
  private generateObsidianNote(): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Deduplicate topics
    const uniqueTopics = [...new Set(this.sessionSummary.mainTopics)].slice(0, 5);
    
    let note = `---
date: ${dateStr}
time: ${timeStr}
project: ${this.sessionSummary.project}
environment: ${config.environment}
tags: [claude-code, ${uniqueTopics.map(t => t.toLowerCase().replace(/\s+/g, '-')).join(', ')}]
tools: [${Array.from(this.sessionSummary.toolsUsed).join(', ')}]
---

# Claude Code Session - ${this.sessionSummary.project}

## Session Overview
- **Date**: ${dateStr} ${timeStr}
- **Duration**: ${this.calculateDuration()}
- **Project**: [[${this.sessionSummary.project}]]

## Summary
`;
    
    // Add main topics
    if (uniqueTopics.length > 0) {
      note += `\n### Topics Covered\n`;
      uniqueTopics.forEach(topic => {
        note += `- ${topic}\n`;
      });
    }
    
    // Add achievements
    if (this.sessionSummary.achievements.length > 0) {
      note += `\n### Achievements\n`;
      this.sessionSummary.achievements.slice(0, 10).forEach(achievement => {
        note += `- ${achievement}\n`;
      });
    }
    
    // Add decisions
    if (this.sessionSummary.decisions.length > 0) {
      note += `\n### Key Decisions\n`;
      this.sessionSummary.decisions.slice(0, 10).forEach(decision => {
        note += `- ${decision}\n`;
      });
    }
    
    // Add tools used
    if (this.sessionSummary.toolsUsed.size > 0) {
      note += `\n## Tools Used\n`;
      Array.from(this.sessionSummary.toolsUsed).forEach(tool => {
        note += `- \`${tool}\`\n`;
      });
    }
    
    // Add files modified
    if (this.sessionSummary.filesModified.size > 0 || this.sessionSummary.filesCreated.size > 0) {
      note += `\n## Files Changed\n`;
      
      if (this.sessionSummary.filesCreated.size > 0) {
        note += `\n### Created\n`;
        Array.from(this.sessionSummary.filesCreated).forEach(file => {
          note += `- \`${file}\`\n`;
        });
      }
      
      if (this.sessionSummary.filesModified.size > 0) {
        note += `\n### Modified\n`;
        Array.from(this.sessionSummary.filesModified).forEach(file => {
          note += `- \`${file}\`\n`;
        });
      }
    }
    
    // Add significant code snippets
    if (this.sessionSummary.codeSnippets.length > 0) {
      note += `\n## Code Highlights\n`;
      this.sessionSummary.codeSnippets.slice(0, 3).forEach(snippet => {
        note += `\n### ${snippet.description}\n`;
        note += `\n\`\`\`${snippet.language}\n${snippet.code}\n\`\`\`\n`;
      });
    }
    
    // Add conversation highlights (last few exchanges)
    note += `\n## Conversation Highlights\n`;
    const recentEntries = this.sessionEntries.slice(-10);
    let lastType = '';
    
    recentEntries.forEach(entry => {
      if (entry.type === 'user' && lastType !== 'user') {
        note += `\n**User**: ${entry.content.substring(0, 200)}${entry.content.length > 200 ? '...' : ''}\n`;
        lastType = 'user';
      } else if (entry.type === 'assistant' && lastType !== 'assistant') {
        note += `\n**Assistant**: ${entry.content.substring(0, 300)}${entry.content.length > 300 ? '...' : ''}\n`;
        lastType = 'assistant';
      }
    });
    
    note += `\n---\n*Generated by MCP ChromaDB Memory Server*`;
    
    return note;
  }
  
  private calculateDuration(): string {
    const duration = this.sessionSummary.endTime.getTime() - this.sessionSummary.startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }
  
  // Save the session to Obsidian
  async saveSession(manualSummary?: string): Promise<string> {
    this.sessionSummary.endTime = new Date();
    
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Clean project name for filename (replace spaces with hyphens)
    const cleanProjectName = this.sessionSummary.project.replace(/\s+/g, '-');
    
    // Improved file naming: YYYY-MM-DD-Project-Name.md
    const fileName = `${year}-${month}-${day}-${cleanProjectName}.md`;
    
    // Create year/month folder structure
    const folderPath = `${this.sessionFolder}/${year}/${month}`;
    const notePath = `${folderPath}/${fileName}`;
    
    // Generate note content
    let noteContent = this.generateObsidianNote();
    
    // Add manual summary if provided
    if (manualSummary) {
      const summaryIndex = noteContent.indexOf('## Summary');
      if (summaryIndex !== -1) {
        const nextSection = noteContent.indexOf('\n##', summaryIndex + 1);
        const insertPoint = nextSection !== -1 ? nextSection : noteContent.indexOf('\n### Topics Covered');
        noteContent = noteContent.slice(0, insertPoint) + `\n${manualSummary}\n` + noteContent.slice(insertPoint);
      }
    }
    
    // Save to Obsidian
    const success = await this.obsidianManager.writeNote(notePath, noteContent);
    
    if (success) {
      return notePath;
    } else {
      throw new Error('Failed to save session to Obsidian');
    }
  }
  
  // Get current session summary
  getSessionSummary(): SessionSummary {
    this.sessionSummary.endTime = new Date();
    return this.sessionSummary;
  }
  
  // Enable/disable auto-save
  setAutoSave(enabled: boolean) {
    this.autoSave = enabled;
  }
}