import { promises as fs } from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { TemplateManager } from './template-manager.js';
import { VaultManager } from './vault-manager.js';
import chokidar from 'chokidar';
import micromatch from 'micromatch';

// Type definitions
export interface VaultStructure {
  version: string;
  name: string;
  description: string;
  folders: FolderDefinition[];
  templates: TemplateMapping[];
  hooks: StructureHook[];
  metadata: StructureMetadata;
}

export interface FolderDefinition {
  path: string;
  name: string;
  prefix?: string;
  description: string;
  templates?: string[];
  children?: FolderDefinition[];
  metadata?: {
    icon?: string;
    color?: string;
    defaultTags?: string[];
    accessLevel?: 'public' | 'team' | 'private';
  };
}

export interface TemplateMapping {
  folderPath: string;
  templateId: string;
  isDefault?: boolean;
  autoApply?: boolean;
  inheritFrom?: string;
  variables?: Record<string, any>;
}

export interface StructureHook {
  id: string;
  name: string;
  trigger: 'folder_created' | 'file_created' | 'file_moved' | 'structure_sync';
  folderPattern?: string;
  action: HookAction;
  config?: Record<string, any>;
}

export interface HookAction {
  type: string;
  [key: string]: any;
}

export interface StructureMetadata {
  version: string;
  author?: string;
  lastUpdated: string;
  compatibility: {
    minVersion: string;
    platforms: string[];
  };
  tags?: {
    structure: string[];
  };
}

export interface GenerationOptions {
  skipExisting?: boolean;
  dryRun?: boolean;
  applyTemplates?: boolean;
  registerHooks?: boolean;
  variables?: Record<string, any>;
}

export interface GenerationReport {
  foldersCreated: number;
  filesCreated: number;
  templatesApplied: number;
  hooksRegistered: number;
  skipped: string[];
  errors: string[];
}

export interface HookContext {
  targetPath: string;
  event: string;
  variables: Record<string, any>;
  structure: VaultStructure;
}

export interface HookResult {
  success: boolean;
  message?: string;
  results?: any[];
}

// Validation schemas
const FolderDefinitionSchema: z.ZodType<FolderDefinition> = z.object({
  path: z.string(),
  name: z.string(),
  prefix: z.string().optional(),
  description: z.string(),
  templates: z.array(z.string()).optional(),
  children: z.array(z.lazy(() => FolderDefinitionSchema)).optional(),
  metadata: z.object({
    icon: z.string().optional(),
    color: z.string().optional(),
    defaultTags: z.array(z.string()).optional(),
    accessLevel: z.enum(['public', 'team', 'private']).optional()
  }).optional()
});

const VaultStructureSchema = z.object({
  version: z.string(),
  name: z.string(),
  description: z.string(),
  folders: z.array(FolderDefinitionSchema),
  templates: z.array(z.object({
    folderPath: z.string(),
    templateId: z.string(),
    isDefault: z.boolean().optional(),
    autoApply: z.boolean().optional(),
    inheritFrom: z.string().optional(),
    variables: z.record(z.any()).optional()
  })),
  hooks: z.array(z.object({
    id: z.string(),
    name: z.string(),
    trigger: z.enum(['folder_created', 'file_created', 'file_moved', 'structure_sync']),
    folderPattern: z.string().optional(),
    action: z.object({
      type: z.string()
    }).passthrough()
  })),
  metadata: z.object({
    version: z.string(),
    author: z.string().optional(),
    lastUpdated: z.string(),
    compatibility: z.object({
      minVersion: z.string(),
      platforms: z.array(z.string())
    }),
    tags: z.object({
      structure: z.array(z.string())
    }).optional()
  })
});

export class VaultStructureManager {
  private structure: VaultStructure | null = null;
  private templateManager: TemplateManager;
  private vaultManager: VaultManager;
  private hookRegistry: Map<string, StructureHook> = new Map();
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private structurePath: string;

  constructor(
    templateManager: TemplateManager,
    vaultManager: VaultManager,
    config: { structurePath?: string } = {}
  ) {
    this.templateManager = templateManager;
    this.vaultManager = vaultManager;
    this.structurePath = config.structurePath || 
      path.join(vaultManager.getActiveVault().path, '.vault-structure.json');
  }

  async initialize(): Promise<void> {
    // Load existing structure if available
    try {
      const data = await fs.readFile(this.structurePath, 'utf-8');
      const structure = JSON.parse(data);
      await this.initializeStructure(structure);
    } catch (error) {
      // No existing structure, that's okay - starting fresh
    }
  }

  async initializeStructure(structureDefinition: VaultStructure): Promise<void> {
    // Validate structure
    const validated = await this.validateStructure(structureDefinition);
    this.structure = validated;
    
    // Save structure definition
    await this.saveStructure();
    
    // Register hooks
    for (const hook of validated.hooks) {
      await this.registerStructureHook(hook);
    }
    
    // Initialize watchers if hooks require them
    await this.initializeWatchers();
  }

  async validateStructure(structure: any): Promise<VaultStructure> {
    try {
      return VaultStructureSchema.parse(structure);
    } catch (error) {
      throw new Error(`Invalid vault structure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateStructure(
    targetPath: string,
    options: GenerationOptions = {}
  ): Promise<GenerationReport> {
    if (!this.structure) {
      throw new Error('No structure loaded');
    }

    const report: GenerationReport = {
      foldersCreated: 0,
      filesCreated: 0,
      templatesApplied: 0,
      hooksRegistered: 0,
      skipped: [],
      errors: []
    };

    if (options.dryRun) {
      // DRY RUN: No changes will be made
    }

    // Create root structure
    for (const folder of this.structure.folders) {
      await this.createFolderRecursive(
        path.join(targetPath, folder.path),
        folder,
        report,
        options
      );
    }

    // Apply structure-level templates if requested
    if (options.applyTemplates !== false) {
      for (const mapping of this.structure.templates) {
        try {
          const folderPath = path.join(targetPath, mapping.folderPath);
          if (mapping.autoApply || options.applyTemplates) {
            await this.applyTemplateMapping(folderPath, mapping, report, options);
          }
        } catch (error) {
          report.errors.push(`Failed to apply template ${mapping.templateId}: ${error}`);
        }
      }
    }

    // Register hooks if requested
    if (options.registerHooks) {
      for (const hook of this.structure.hooks) {
        try {
          await this.registerStructureHook(hook);
          report.hooksRegistered++;
        } catch (error) {
          report.errors.push(`Failed to register hook ${hook.id}: ${error}`);
        }
      }
    }

    return report;
  }

  private async createFolderRecursive(
    folderPath: string,
    folder: FolderDefinition,
    report: GenerationReport,
    options: GenerationOptions
  ): Promise<void> {
    try {
      // Check if folder exists
      const exists = await fs.access(folderPath).then(() => true).catch(() => false);
      
      if (exists && options.skipExisting) {
        report.skipped.push(folderPath);
        return;
      }

      // Create folder
      if (!options.dryRun && !exists) {
        await fs.mkdir(folderPath, { recursive: true });
        report.foldersCreated++;
      }

      // Create metadata file if specified
      if (folder.metadata && !options.dryRun) {
        const metadataPath = path.join(folderPath, '.folder-meta.json');
        await fs.writeFile(metadataPath, JSON.stringify(folder.metadata, null, 2));
      }

      // Apply folder templates
      if (folder.templates && options.applyTemplates !== false) {
        for (const templateId of folder.templates) {
          try {
            const template = await this.templateManager.getTemplate(templateId);
            if (template) {
              const content = await this.templateManager.applyTemplate(templateId, {
                ...options.variables,
                folder: {
                  name: folder.name,
                  path: folder.path,
                  description: folder.description
                }
              });
              
              const filename = `${folder.name.toLowerCase().replace(/\s+/g, '-')}.md`;
              const filePath = path.join(folderPath, filename);
              
              if (!options.dryRun) {
                await fs.writeFile(filePath, content);
                report.filesCreated++;
                report.templatesApplied++;
              }
            }
          } catch (error) {
            report.errors.push(`Failed to apply template ${templateId}: ${error}`);
          }
        }
      }

      // Create child folders
      if (folder.children) {
        for (const child of folder.children) {
          const childPath = path.join(folderPath, child.path);
          await this.createFolderRecursive(childPath, child, report, options);
        }
      }

      // Trigger folder created hook
      if (!options.dryRun && this.hookRegistry.size > 0) {
        await this.triggerHooks('folder_created', folderPath, { folder });
      }

    } catch (error) {
      report.errors.push(`Failed to create folder ${folderPath}: ${error}`);
    }
  }

  private async applyTemplateMapping(
    folderPath: string,
    mapping: TemplateMapping,
    report: GenerationReport,
    options: GenerationOptions
  ): Promise<void> {
    // Handle wildcard paths
    if (mapping.folderPath.includes('*')) {
      const basePath = path.dirname(folderPath);
      const pattern = path.basename(mapping.folderPath);
      
      try {
        const folders = await fs.readdir(basePath, { withFileTypes: true });
        for (const folder of folders) {
          if (folder.isDirectory() && micromatch.isMatch(folder.name, pattern)) {
            const targetPath = path.join(basePath, folder.name);
            await this.applyTemplateMappingToFolder(
              targetPath,
              mapping,
              report,
              options,
              { folderName: folder.name }
            );
          }
        }
      } catch (error) {
        // Directory doesn't exist yet, that's okay
      }
    } else {
      await this.applyTemplateMappingToFolder(folderPath, mapping, report, options);
    }
  }

  private async applyTemplateMappingToFolder(
    folderPath: string,
    mapping: TemplateMapping,
    report: GenerationReport,
    options: GenerationOptions,
    additionalVars: Record<string, any> = {}
  ): Promise<void> {
    try {
      const template = await this.templateManager.getTemplate(mapping.templateId);
      if (!template) {
        throw new Error(`Template ${mapping.templateId} not found`);
      }

      const variables = {
        ...options.variables,
        ...mapping.variables,
        ...additionalVars,
        folder: {
          path: folderPath,
          name: path.basename(folderPath)
        }
      };

      const content = await this.templateManager.applyTemplate(mapping.templateId, variables);
      
      // Determine filename
      const filename = mapping.isDefault ? 
        `${path.basename(folderPath).toLowerCase().replace(/\s+/g, '-')}.md` :
        `${mapping.templateId}.md`;
      
      const filePath = path.join(folderPath, filename);
      
      if (!options.dryRun) {
        await fs.writeFile(filePath, content);
        report.filesCreated++;
        report.templatesApplied++;
      }
    } catch (error) {
      report.errors.push(`Failed to apply template mapping: ${error}`);
    }
  }

  async registerStructureHook(hook: StructureHook): Promise<void> {
    this.hookRegistry.set(hook.id, hook);
    
    // Set up watcher if needed
    if (hook.folderPattern && hook.trigger !== 'structure_sync') {
      await this.setupWatcher(hook);
    }
  }

  private async setupWatcher(hook: StructureHook): Promise<void> {
    if (!hook.folderPattern) return;

    const vaultPath = this.vaultManager.getActiveVault().path;
    const watchPath = path.join(vaultPath, hook.folderPattern);

    // Create watcher
    const watcher = chokidar.watch(watchPath, {
      persistent: true,
      ignoreInitial: true,
      depth: hook.folderPattern.includes('**') ? undefined : 0
    });

    // Set up event handlers based on trigger
    switch (hook.trigger) {
      case 'folder_created':
        watcher.on('addDir', async (dirPath) => {
          await this.executeHook(hook.id, {
            targetPath: dirPath,
            event: 'folder_created',
            variables: { folderName: path.basename(dirPath) },
            structure: this.structure!
          });
        });
        break;

      case 'file_created':
        watcher.on('add', async (filePath) => {
          await this.executeHook(hook.id, {
            targetPath: filePath,
            event: 'file_created',
            variables: { fileName: path.basename(filePath) },
            structure: this.structure!
          });
        });
        break;

      case 'file_moved':
        watcher.on('unlink', async (oldPath) => {
          // Track for potential move
          setTimeout(async () => {
            // Check if a new file was created (indicating a move)
            // This is simplified - real implementation would be more robust
          }, 100);
        });
        break;
    }

    this.watchers.set(hook.id, watcher);
  }

  async executeHook(hookId: string, context: HookContext): Promise<HookResult> {
    const hook = this.hookRegistry.get(hookId);
    if (!hook) {
      return { success: false, message: `Hook ${hookId} not found` };
    }

    try {
      switch (hook.action.type) {
        case 'create_subfolders':
          return await this.executeCreateSubfolders(hook.action, context);
          
        case 'apply_template_set':
          return await this.executeApplyTemplateSet(hook.action, context);
          
        case 'index_snippet':
          return await this.executeIndexSnippet(hook.action, context);
          
        case 'generate_hub':
          return await this.executeGenerateHub(hook.action, context);
          
        case 'link_active_projects':
          return await this.executeLinkActiveProjects(hook.action, context);
          
        default:
          return { success: false, message: `Unknown hook action: ${hook.action.type}` };
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Hook execution failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  private async executeCreateSubfolders(
    action: any,
    context: HookContext
  ): Promise<HookResult> {
    const results = [];
    
    for (const folder of action.folders || []) {
      const folderPath = path.join(context.targetPath, folder);
      await fs.mkdir(folderPath, { recursive: true });
      results.push(`Created ${folderPath}`);
      
      // Apply templates if configured
      if (action.applyTemplates) {
        const mapping = this.structure?.templates.find(t => 
          t.folderPath.includes(folder)
        );
        if (mapping) {
          await this.applyTemplateMappingToFolder(
            folderPath,
            mapping,
            { foldersCreated: 0, filesCreated: 0, templatesApplied: 0, hooksRegistered: 0, skipped: [], errors: [] },
            {}
          );
          results.push(`Applied template to ${folderPath}`);
        }
      }
    }
    
    return { success: true, results };
  }

  private async executeApplyTemplateSet(
    action: any,
    context: HookContext
  ): Promise<HookResult> {
    const results = [];
    
    for (const templateId of action.templates || []) {
      try {
        const content = await this.templateManager.applyTemplate(templateId, {
          ...context.variables,
          parentFolder: context.targetPath
        });
        
        const filename = `${templateId}.md`;
        const filePath = path.join(context.targetPath, filename);
        
        await fs.writeFile(filePath, content);
        results.push(`Applied template ${templateId} to ${filePath}`);
      } catch (error) {
        results.push(`Failed to apply template ${templateId}: ${error}`);
      }
    }
    
    return { success: true, results };
  }

  private async executeIndexSnippet(
    action: any,
    context: HookContext
  ): Promise<HookResult> {
    // This would integrate with the memory manager to index the snippet
    // For now, we'll add metadata
    const snippetPath = context.targetPath;
    const metadataPath = snippetPath.replace(/\.md$/, '.meta.json');
    
    const metadata = {
      indexed: new Date().toISOString(),
      tags: action.generateTags ? await this.generateSnippetTags(snippetPath) : [],
      language: path.basename(path.dirname(snippetPath)),
      addedToSearch: action.addToSearchIndex || false
    };
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    return { 
      success: true, 
      results: [`Indexed snippet ${path.basename(snippetPath)}`] 
    };
  }

  private async executeGenerateHub(
    action: any,
    context: HookContext
  ): Promise<HookResult> {
    const hubPath = path.join(context.targetPath, 'README.md');
    const folderName = path.basename(context.targetPath);
    
    // Generate hub content
    const hubContent = await this.generateHubContent(
      context.targetPath,
      folderName,
      action.hubTemplate,
      action.linkChildren
    );
    
    await fs.writeFile(hubPath, hubContent);
    
    return { 
      success: true, 
      results: [`Generated hub for ${folderName}`] 
    };
  }

  private async executeLinkActiveProjects(
    action: any,
    context: HookContext
  ): Promise<HookResult> {
    // This would scan for active projects and add links
    // For now, we'll create a placeholder
    const content = await fs.readFile(context.targetPath, 'utf-8');
    const projectsPath = path.join(
      this.vaultManager.getActiveVault().path,
      '10-Active-Projects'
    );
    
    try {
      const projects = await fs.readdir(projectsPath, { withFileTypes: true });
      const activeProjects = projects
        .filter(p => p.isDirectory())
        .map(p => p.name);
      
      // Update content with project links
      // This is simplified - real implementation would parse and update properly
      const updatedContent = content.replace(
        '## 🚀 Active Projects',
        `## 🚀 Active Projects\n\n${activeProjects.map(p => 
          `### [[10-Active-Projects/${p}/project-overview|${p}]]`
        ).join('\n')}`
      );
      
      await fs.writeFile(context.targetPath, updatedContent);
      
      return { 
        success: true, 
        results: [`Linked ${activeProjects.length} active projects`] 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to link projects: ${error}` 
      };
    }
  }

  private async generateSnippetTags(snippetPath: string): Promise<string[]> {
    const content = await fs.readFile(snippetPath, 'utf-8');
    const tags = new Set<string>();
    
    // Extract language from path
    const language = path.basename(path.dirname(snippetPath));
    tags.add(`#lang/${language}`);
    
    // Extract pattern type from content
    if (content.includes('algorithm')) tags.add('#pattern/algorithm');
    if (content.includes('data structure')) tags.add('#pattern/data-structure');
    if (content.includes('utility')) tags.add('#pattern/utility');
    
    // Add snippet tag
    tags.add('#type/snippet');
    
    return Array.from(tags);
  }

  private async generateHubContent(
    folderPath: string,
    folderName: string,
    templateId?: string,
    linkChildren?: boolean
  ): Promise<string> {
    let content = `# ${folderName} Hub\n\n`;
    content += `**Location**: ${folderPath}\n`;
    content += `**Generated**: ${new Date().toISOString()}\n\n`;
    
    if (linkChildren) {
      const items = await fs.readdir(folderPath, { withFileTypes: true });
      
      content += `## Contents\n\n`;
      
      // Folders
      const folders = items.filter(i => i.isDirectory());
      if (folders.length > 0) {
        content += `### Folders\n`;
        for (const folder of folders) {
          content += `- [[${folder.name}/README|${folder.name}]]\n`;
        }
        content += '\n';
      }
      
      // Files
      const files = items.filter(i => i.isFile() && i.name.endsWith('.md'));
      if (files.length > 0) {
        content += `### Documents\n`;
        for (const file of files) {
          const name = file.name.replace('.md', '');
          content += `- [[${name}]]\n`;
        }
      }
    }
    
    return content;
  }

  private async triggerHooks(
    event: string,
    targetPath: string,
    variables: Record<string, any>
  ): Promise<void> {
    for (const [id, hook] of this.hookRegistry) {
      if (hook.trigger === event && hook.folderPattern) {
        const relativePath = path.relative(
          this.vaultManager.getActiveVault().path,
          targetPath
        );
        
        if (micromatch.isMatch(relativePath, hook.folderPattern)) {
          await this.executeHook(id, {
            targetPath,
            event,
            variables,
            structure: this.structure!
          });
        }
      }
    }
  }

  private async saveStructure(): Promise<void> {
    if (!this.structure) return;
    
    await fs.writeFile(
      this.structurePath,
      JSON.stringify(this.structure, null, 2)
    );
  }

  private async initializeWatchers(): Promise<void> {
    // Watchers are set up individually when hooks are registered
    // This method could be used for global initialization if needed
  }

  async importStructure(source: string | VaultStructure): Promise<VaultStructure> {
    let structure: VaultStructure;
    
    if (typeof source === 'string') {
      // Import from file or URL
      if (source.startsWith('http')) {
        // Fetch from URL
        const response = await fetch(source);
        structure = await response.json();
      } else {
        // Read from file
        const data = await fs.readFile(source, 'utf-8');
        structure = JSON.parse(data);
      }
    } else {
      structure = source;
    }
    
    // Validate and initialize
    await this.initializeStructure(structure);
    
    return structure;
  }

  async exportStructure(targetPath?: string): Promise<string> {
    if (!this.structure) {
      throw new Error('No structure loaded');
    }
    
    const exportPath = targetPath || `vault-structure-${Date.now()}.json`;
    await fs.writeFile(exportPath, JSON.stringify(this.structure, null, 2));
    
    return exportPath;
  }

  getStructure(): VaultStructure | null {
    return this.structure;
  }

  async close(): Promise<void> {
    // Close all watchers
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();
    this.hookRegistry.clear();
  }
}