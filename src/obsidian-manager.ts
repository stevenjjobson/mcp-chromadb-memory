import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { ChromaClient } from 'chromadb';
import { OpenAI } from 'openai';
import { config } from './config.js';

interface ObsidianNote {
  path: string;
  title: string;
  content: string;
  frontmatter: Record<string, any>;
  tags: string[];
  links: string[];
  createdAt: Date;
  modifiedAt: Date;
}

interface SearchResult {
  note: ObsidianNote;
  score: number;
  excerpt: string;
}

interface IndexingProgress {
  total: number;
  indexed: number;
  failed: number;
  skipped: number;
  estimatedCost: number;
}

interface IndexingOptions {
  folders?: string[];
  tags?: string[];
  forceReindex?: boolean;
  dryRun?: boolean;
}

export class ObsidianManager {
  private vaultPath: string;
  private chromaClient: ChromaClient;
  private collection: any;
  private openai: OpenAI;

  constructor(vaultPath: string, chromaClient: ChromaClient) {
    this.vaultPath = vaultPath;
    this.chromaClient = chromaClient;
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });
  }

  async initialize() {
    // Verify vault exists
    try {
      await fs.access(this.vaultPath);
    } catch (error) {
      throw new Error(`Obsidian vault not found at: ${this.vaultPath}`);
    }

    // Create or get ChromaDB collection for Obsidian notes
    try {
      this.collection = await this.chromaClient.getOrCreateCollection({
        name: 'obsidian_notes',
        metadata: { 'hnsw:space': 'cosine' },
        embeddingFunction: {
          generate: async (texts: string[]) => {
            const response = await this.openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: texts,
            });
            return response.data.map(item => item.embedding);
          }
        }
      });
    } catch (error) {
      console.error('Failed to create Obsidian collection:', error);
      throw error;
    }
  }

  // Read a specific note by path
  async readNote(notePath: string): Promise<ObsidianNote | null> {
    const fullPath = path.join(this.vaultPath, notePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);
      
      // Parse frontmatter and content
      const { data: frontmatter, content: noteContent } = matter(content);
      
      // Extract tags from frontmatter and content
      const tags = this.extractTags(frontmatter, noteContent);
      
      // Extract links (wiki-style and markdown)
      const links = this.extractLinks(noteContent);
      
      // Get title from frontmatter or filename
      const title = frontmatter.title || path.basename(notePath, '.md');
      
      return {
        path: notePath,
        title,
        content: noteContent,
        frontmatter,
        tags,
        links,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    } catch (error) {
      console.error(`Failed to read note ${notePath}:`, error);
      return null;
    }
  }

  // List all notes in the vault or a specific folder
  async listNotes(folderPath: string = ''): Promise<string[]> {
    const searchPath = path.join(this.vaultPath, folderPath);
    const notes: string[] = [];
    
    async function walkDirectory(dir: string, baseDir: string) {
      const files = await fs.readdir(dir, { withFileTypes: true });
      
      for (const file of files) {
        const filePath = path.join(dir, file.name);
        
        if (file.isDirectory() && !file.name.startsWith('.')) {
          // Recursively walk subdirectories, skip hidden folders
          await walkDirectory(filePath, baseDir);
        } else if (file.isFile() && file.name.endsWith('.md')) {
          // Add markdown files to the list
          const relativePath = path.relative(baseDir, filePath);
          notes.push(relativePath.replace(/\\/g, '/'));
        }
      }
    }
    
    try {
      await walkDirectory(searchPath, this.vaultPath);
      return notes.sort();
    } catch (error) {
      console.error('Failed to list notes:', error);
      return [];
    }
  }

  // Search notes using ChromaDB embeddings
  async searchNotes(query: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit
      });
      
      if (!results.ids[0].length) {
        return [];
      }
      
      const searchResults: SearchResult[] = [];
      
      for (let i = 0; i < results.ids[0].length; i++) {
        const notePath = results.ids[0][i];
        const distance = results.distances?.[0][i] || 0;
        const metadata = results.metadatas?.[0][i] || {};
        
        const note = await this.readNote(notePath);
        if (note) {
          searchResults.push({
            note,
            score: 1 - distance, // Convert distance to similarity score
            excerpt: this.createExcerpt(note.content, query)
          });
        }
      }
      
      return searchResults;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  // Write or update a note
  async writeNote(notePath: string, content: string, frontmatter?: Record<string, any>): Promise<boolean> {
    const fullPath = path.join(this.vaultPath, notePath);
    
    try {
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Combine frontmatter and content
      let fullContent = content;
      if (frontmatter && Object.keys(frontmatter).length > 0) {
        fullContent = matter.stringify(content, frontmatter);
      }
      
      // Write the file
      await fs.writeFile(fullPath, fullContent, 'utf-8');
      
      // Update ChromaDB index
      await this.indexNote(notePath);
      
      return true;
    } catch (error) {
      console.error(`Failed to write note ${notePath}:`, error);
      return false;
    }
  }

  // Get all notes linking to a specific note
  async getBacklinks(notePath: string): Promise<string[]> {
    const noteTitle = path.basename(notePath, '.md');
    const allNotes = await this.listNotes();
    const backlinks: string[] = [];
    
    for (const note of allNotes) {
      if (note === notePath) continue;
      
      const noteData = await this.readNote(note);
      if (noteData && noteData.links.includes(noteTitle)) {
        backlinks.push(note);
      }
    }
    
    return backlinks;
  }

  // Bulk index vault or specific folders
  async indexVault(options: IndexingOptions = {}): Promise<IndexingProgress> {
    const progress: IndexingProgress = {
      total: 0,
      indexed: 0,
      failed: 0,
      skipped: 0,
      estimatedCost: 0
    };

    console.error('Starting Obsidian vault indexing...');
    
    // Get all notes to index
    const allNotes = await this.listNotes();
    let notesToIndex = allNotes;
    
    // Filter by folders if specified
    if (options.folders && options.folders.length > 0) {
      notesToIndex = notesToIndex.filter(note => 
        options.folders!.some(folder => note.startsWith(folder))
      );
    }
    
    progress.total = notesToIndex.length;
    
    // Estimate cost (rough approximation)
    // Average note ~500 words = ~750 tokens
    const estimatedTokens = progress.total * 750;
    progress.estimatedCost = (estimatedTokens / 1000) * 0.00002; // $0.00002 per 1K tokens
    
    if (options.dryRun) {
      console.error(`Dry run: Would index ${progress.total} notes`);
      console.error(`Estimated cost: $${progress.estimatedCost.toFixed(4)}`);
      return progress;
    }
    
    // Check existing indexed notes
    const existingNotes = await this.getIndexedNotes();
    
    for (const notePath of notesToIndex) {
      try {
        // Skip if already indexed and not forcing reindex
        if (!options.forceReindex && existingNotes.has(notePath)) {
          const note = await this.readNote(notePath);
          if (note) {
            const existingMeta = existingNotes.get(notePath);
            if (existingMeta?.modifiedAt === note.modifiedAt.toISOString()) {
              progress.skipped++;
              continue;
            }
          }
        }
        
        // Filter by tags if specified
        if (options.tags && options.tags.length > 0) {
          const note = await this.readNote(notePath);
          if (!note || !options.tags.some(tag => note.tags.includes(tag))) {
            progress.skipped++;
            continue;
          }
        }
        
        // Index the note
        await this.indexNote(notePath);
        progress.indexed++;
        
        // Log progress every 10 notes
        if (progress.indexed % 10 === 0) {
          console.error(`Progress: ${progress.indexed}/${progress.total} indexed`);
        }
        
        // Add small delay to avoid rate limiting
        if (progress.indexed % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`Failed to index ${notePath}:`, error);
        progress.failed++;
      }
    }
    
    // Store indexing metadata
    await this.updateIndexingMetadata({
      lastIndexed: new Date().toISOString(),
      totalNotes: progress.total,
      indexedNotes: progress.indexed,
      folders: options.folders,
      tags: options.tags
    });
    
    console.error(`Indexing complete: ${progress.indexed} indexed, ${progress.skipped} skipped, ${progress.failed} failed`);
    return progress;
  }
  
  // Get status of indexed notes
  async getIndexStatus(): Promise<{
    totalNotes: number;
    indexedNotes: number;
    lastIndexed: string | null;
    metadata: any;
  }> {
    const allNotes = await this.listNotes();
    const indexedNotes = await this.getIndexedNotes();
    
    // Get indexing metadata
    let metadata: any = {};
    try {
      const result = await this.collection.get({
        ids: ['__indexing_metadata__']
      });
      if (result.metadatas && result.metadatas.length > 0) {
        metadata = result.metadatas[0];
      }
    } catch (error) {
      // No metadata yet
    }
    
    return {
      totalNotes: allNotes.length,
      indexedNotes: indexedNotes.size,
      lastIndexed: metadata.lastIndexed || null,
      metadata
    };
  }
  
  // Clear all indexed notes
  async clearIndex(): Promise<void> {
    try {
      // Get all document IDs
      const allDocs = await this.collection.get();
      if (allDocs.ids && allDocs.ids.length > 0) {
        await this.collection.delete({
          ids: allDocs.ids
        });
      }
      console.error('Obsidian index cleared');
    } catch (error) {
      console.error('Failed to clear index:', error);
      throw error;
    }
  }
  
  // Get map of indexed notes with their metadata
  private async getIndexedNotes(): Promise<Map<string, any>> {
    const indexed = new Map<string, any>();
    try {
      const results = await this.collection.get();
      if (results.ids && results.metadatas) {
        for (let i = 0; i < results.ids.length; i++) {
          if (results.ids[i] !== '__indexing_metadata__') {
            indexed.set(results.ids[i], results.metadatas[i]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to get indexed notes:', error);
    }
    return indexed;
  }
  
  // Update indexing metadata
  private async updateIndexingMetadata(metadata: any): Promise<void> {
    try {
      await this.collection.upsert({
        ids: ['__indexing_metadata__'],
        documents: ['Indexing metadata'],
        metadatas: [metadata]
      });
    } catch (error) {
      console.error('Failed to update indexing metadata:', error);
    }
  }

  // Index a note in ChromaDB
  private async indexNote(notePath: string): Promise<void> {
    const note = await this.readNote(notePath);
    if (!note) return;
    
    try {
      await this.collection.upsert({
        ids: [notePath],
        documents: [note.content],
        metadatas: [{
          title: note.title,
          tags: note.tags.join(','),
          createdAt: note.createdAt.toISOString(),
          modifiedAt: note.modifiedAt.toISOString(),
          ...note.frontmatter
        }]
      });
    } catch (error) {
      console.error(`Failed to index note ${notePath}:`, error);
    }
  }

  // Extract tags from frontmatter and content
  private extractTags(frontmatter: Record<string, any>, content: string): string[] {
    const tags = new Set<string>();
    
    // Tags from frontmatter
    if (frontmatter.tags) {
      if (Array.isArray(frontmatter.tags)) {
        frontmatter.tags.forEach(tag => tags.add(tag));
      } else if (typeof frontmatter.tags === 'string') {
        frontmatter.tags.split(',').forEach(tag => tags.add(tag.trim()));
      }
    }
    
    // Tags from content (#tag format)
    const tagMatches = content.match(/#[a-zA-Z0-9_-]+/g) || [];
    tagMatches.forEach(tag => tags.add(tag.substring(1)));
    
    return Array.from(tags);
  }

  // Extract links from content
  private extractLinks(content: string): string[] {
    const links = new Set<string>();
    
    // Wiki-style links [[Note Name]]
    const wikiLinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
    wikiLinks.forEach(link => {
      const noteName = link.slice(2, -2).split('|')[0].trim();
      links.add(noteName);
    });
    
    // Markdown links [text](note.md)
    const mdLinks = content.match(/\[([^\]]+)\]\(([^)]+\.md)\)/g) || [];
    mdLinks.forEach(link => {
      const match = link.match(/\[([^\]]+)\]\(([^)]+\.md)\)/);
      if (match) {
        const noteName = path.basename(match[2], '.md');
        links.add(noteName);
      }
    });
    
    return Array.from(links);
  }

  // Create excerpt around search term
  private createExcerpt(content: string, query: string, contextLength: number = 150): string {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);
    
    if (index === -1) {
      // If exact match not found, return beginning of content
      return content.substring(0, contextLength) + '...';
    }
    
    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(content.length, index + query.length + contextLength / 2);
    
    let excerpt = content.substring(start, end);
    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt = excerpt + '...';
    
    return excerpt;
  }
}