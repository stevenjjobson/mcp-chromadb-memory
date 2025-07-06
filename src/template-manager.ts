import { promises as fs } from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import moment from 'moment';
import matter from 'gray-matter';
import { createHash } from 'crypto';
import { VaultManager } from './vault-manager.js';
import { HttpClient } from './services/http-client.js';
import { z } from 'zod';

// Template types
export interface Template {
  id: string;
  name: string;
  description: string;
  version: string;
  category: TemplateCategory;
  source: TemplateSource;
  content: string;
  variables: TemplateVariable[];
  metadata: TemplateMetadata;
  checksum: string;
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  default?: any;
  validation?: ValidationRule;
  options?: any[];
}

export interface TemplateSource {
  type: 'webhook' | 'file' | 'git' | 'api';
  url: string;
  auth?: AuthConfig;
  syncEnabled?: boolean;
  syncInterval?: number;
}

export interface TemplateMetadata {
  author?: string;
  created: Date;
  updated: Date;
  tags: string[];
  downloads?: number;
  rating?: number;
}

export interface WebhookConfig {
  name: string;
  url: string;
  authType: 'none' | 'bearer' | 'api-key' | 'oauth';
  authCredentials?: string;
  headers?: Record<string, string>;
  syncInterval?: number;
  autoImport?: boolean;
  registrationEndpoint?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  type: string;
  message: string;
  field?: string;
}

export interface SyncReport {
  synced: number;
  updated: number;
  failed: number;
  sources: string[];
  errors?: string[];
}

export type TemplateCategory = 'session' | 'decision' | 'pattern' | 'solution' | 'snippet' | 'meeting' | 'review' | 'incident' | 'custom';

interface ValidationRule {
  pattern?: string;
  min?: number;
  max?: number;
  enum?: any[];
}

interface AuthConfig {
  type: 'bearer' | 'api-key' | 'oauth' | 'none';
  token?: string;
  key?: string;
  header?: string;
}

interface TemplateRegistry {
  templates: Template[];
  sources: RegisteredSource[];
}

interface RegisteredSource {
  id: string;
  name: string;
  url: string;
  syncEnabled: boolean;
  lastSync?: Date;
  config: WebhookConfig;
}

export class TemplateManager {
  private registry: TemplateRegistry = { templates: [], sources: [] };
  private handlebars: typeof Handlebars;
  private httpClient: HttpClient;
  private registryPath: string;
  private cacheDir: string;
  private webhooks: Map<string, WebhookConfig> = new Map();

  constructor(
    private vaultManager: VaultManager,
    private config: {
      cacheDir?: string;
      maxTemplateSize?: number;
      securityScan?: boolean;
      allowedSources?: string[];
    } = {}
  ) {
    this.httpClient = new HttpClient();
    this.handlebars = Handlebars.create();
    this.registerHelpers();
    
    // Set paths relative to vault
    const vaultPath = this.vaultManager.getActiveVault()?.path || '.';
    this.registryPath = path.join(vaultPath, '.template-registry.json');
    this.cacheDir = config.cacheDir || path.join(vaultPath, '.template-cache');
  }

  async initialize(): Promise<void> {
    // Ensure cache directory exists
    await fs.mkdir(this.cacheDir, { recursive: true });
    
    // Load registry
    await this.loadRegistry();
    
    // Start sync intervals for enabled sources
    for (const source of this.registry.sources) {
      if (source.syncEnabled && source.config.syncInterval) {
        this.startSyncInterval(source);
      }
    }
  }

  // Core operations
  async importTemplate(source: TemplateSource): Promise<Template> {
    // Validate source URL if allowed sources are configured
    if (this.config.allowedSources && this.config.allowedSources.length > 0) {
      const url = new URL(source.url);
      const allowed = this.config.allowedSources.some(allowed => 
        url.hostname.includes(allowed)
      );
      if (!allowed) {
        throw new Error(`Template source ${url.hostname} is not in allowed sources`);
      }
    }

    // Fetch template content
    const content = await this.fetchTemplateContent(source);
    
    // Validate template
    const validation = await this.validateTemplate(content);
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Parse template
    const template = await this.parseTemplate(content, source);
    
    // Save to cache and registry
    await this.saveTemplate(template);
    
    return template;
  }

  async applyTemplate(templateId: string, variables: Record<string, any>): Promise<string> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate required variables
    this.validateRequiredVariables(template, variables);
    
    // Apply defaults
    const finalVariables = this.applyDefaults(template, variables);
    
    // Add system variables
    const enrichedVariables = {
      ...finalVariables,
      _system: {
        date: new Date().toISOString(),
        timestamp: Date.now(),
        vault: this.vaultManager.getActiveVault()?.name || 'default',
        user: process.env.USER || 'unknown'
      }
    };

    // Compile and render template
    const compiled = this.handlebars.compile(template.content);
    return compiled(enrichedVariables);
  }

  async syncTemplates(): Promise<SyncReport> {
    const report: SyncReport = {
      synced: 0,
      updated: 0,
      failed: 0,
      sources: [],
      errors: []
    };

    for (const source of this.registry.sources) {
      try {
        const templates = await this.fetchTemplatesFromSource(source);
        
        for (const templateData of templates) {
          try {
            const existing = this.registry.templates.find(t => 
              t.source.url === source.url && t.name === templateData.name
            );

            if (existing && existing.checksum !== templateData.checksum) {
              // Update existing template
              await this.updateTemplate(existing.id, templateData);
              report.updated++;
            } else if (!existing) {
              // Import new template
              await this.importTemplate({
                type: 'webhook',
                url: `${source.url}/${templateData.id}`,
                auth: source.config.authType !== 'none' ? {
                  type: source.config.authType,
                  token: source.config.authCredentials
                } : undefined
              });
              report.synced++;
            }
          } catch (error) {
            report.failed++;
            report.errors?.push(`Failed to sync template ${templateData.name}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        report.sources.push(source.name);
        source.lastSync = new Date();
      } catch (error) {
        report.errors?.push(`Failed to sync source ${source.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    await this.saveRegistry();
    return report;
  }

  async validateTemplate(content: string): Promise<ValidationResult> {
    const validation: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      // Parse frontmatter
      const { data, content: body } = matter(content);
      
      // Validate structure
      if (!data.template || data.template !== true) {
        validation.errors.push({
          type: 'structure',
          message: 'Template must have "template: true" in frontmatter'
        });
      }

      if (!data.name) {
        validation.errors.push({
          type: 'structure',
          message: 'Template must have a name',
          field: 'name'
        });
      }

      if (!data.version) {
        validation.errors.push({
          type: 'structure',
          message: 'Template must have a version',
          field: 'version'
        });
      }

      // Validate variables
      if (data.variables && Array.isArray(data.variables)) {
        for (const variable of data.variables) {
          if (!variable.name) {
            validation.errors.push({
              type: 'variable',
              message: 'Variable must have a name',
              field: 'variables'
            });
          }

          if (!['string', 'number', 'boolean', 'date', 'array', 'object'].includes(variable.type)) {
            validation.errors.push({
              type: 'variable',
              message: `Invalid variable type: ${variable.type}`,
              field: `variables.${variable.name}`
            });
          }
        }

        // Check for variable usage in content
        const variablePattern = /\{\{([^}]+)\}\}/g;
        const usedVariables = new Set<string>();
        let match;
        
        while ((match = variablePattern.exec(body)) !== null) {
          const varName = match[1].trim().split('.')[0];
          if (!varName.startsWith('_system')) {
            usedVariables.add(varName);
          }
        }

        // Warn about unused variables
        for (const variable of data.variables) {
          if (!usedVariables.has(variable.name)) {
            validation.warnings.push({
              type: 'unused',
              message: `Variable "${variable.name}" is defined but not used in template`,
              field: `variables.${variable.name}`
            });
          }
        }
      }

      // Security checks
      if (this.config.securityScan !== false) {
        this.performSecurityChecks(content, validation);
      }

      // Size check
      if (this.config.maxTemplateSize && content.length > this.config.maxTemplateSize) {
        validation.errors.push({
          type: 'size',
          message: `Template exceeds maximum size of ${this.config.maxTemplateSize} bytes`
        });
      }

    } catch (error) {
      validation.valid = false;
      validation.errors.push({
        type: 'parse_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }

    validation.valid = validation.errors.length === 0;
    return validation;
  }

  // Registry operations
  async listTemplates(filter?: { category?: string; source?: string }): Promise<Template[]> {
    let templates = [...this.registry.templates];

    if (filter?.category) {
      templates = templates.filter(t => t.category === filter.category);
    }

    if (filter?.source) {
      templates = templates.filter(t => t.source.url.includes(filter.source!));
    }

    return templates;
  }

  async getTemplate(id: string): Promise<Template | null> {
    return this.registry.templates.find(t => t.id === id) || null;
  }

  async deleteTemplate(id: string): Promise<void> {
    const index = this.registry.templates.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error(`Template ${id} not found`);
    }

    // Remove from registry
    this.registry.templates.splice(index, 1);

    // Remove cache file
    const cachePath = path.join(this.cacheDir, `${id}.json`);
    try {
      await fs.unlink(cachePath);
    } catch (error) {
      // Ignore if cache file doesn't exist
    }

    await this.saveRegistry();
  }

  // Webhook operations
  async registerWebhook(config: WebhookConfig): Promise<string> {
    // Validate webhook URL
    try {
      new URL(config.url);
    } catch (error) {
      throw new Error(`Invalid webhook URL: ${config.url}`);
    }

    // Generate webhook ID
    const id = this.generateWebhookId(config);
    
    // Store webhook configuration
    this.webhooks.set(id, config);
    
    // Add to registry sources
    this.registry.sources.push({
      id,
      name: config.name,
      url: config.url,
      syncEnabled: config.syncInterval ? true : false,
      config
    });

    // Register with external service if needed
    if (config.registrationEndpoint) {
      await this.registerWithService(config);
    }

    await this.saveRegistry();
    
    // Start sync interval if configured
    if (config.syncInterval) {
      const source = this.registry.sources.find(s => s.id === id);
      if (source) {
        this.startSyncInterval(source);
      }
    }

    return id;
  }

  async handleWebhook(payload: any, headers: Record<string, string>): Promise<void> {
    // Find matching webhook by signature or other means
    const webhookId = this.findWebhookByHeaders(headers);
    if (!webhookId) {
      throw new Error('No matching webhook found');
    }

    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error('Webhook configuration not found');
    }

    // Verify signature if configured
    if (headers['x-template-signature']) {
      const valid = this.verifyWebhookSignature(payload, headers['x-template-signature'] as string, webhook);
      if (!valid) {
        throw new Error('Invalid webhook signature');
      }
    }

    // Process webhook event
    const event = this.parseWebhookEvent(payload);
    await this.processWebhookEvent(event, webhook);
  }

  async testWebhook(webhookId: string): Promise<{ success: boolean; message: string }> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return { success: false, message: 'Webhook not found' };
    }

    try {
      const response = await this.httpClient.get(webhook.url, {
        headers: this.buildHeaders(webhook)
      });

      if (response.status === 200) {
        return { success: true, message: 'Webhook is accessible' };
      } else {
        return { success: false, message: `Webhook returned status ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  // Private helper methods
  private registerHelpers(): void {
    // Date formatting
    this.handlebars.registerHelper('formatDate', (date: any, format: string) => {
      return moment(date).format(format);
    });

    // Conditional helpers
    this.handlebars.registerHelper('when', function(this: any, condition: any, options: any) {
      if (condition) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Array/List helpers
    this.handlebars.registerHelper('join', (array: any[], separator?: string) => {
      if (!Array.isArray(array)) return '';
      return array.join(separator || ', ');
    });

    // String helpers
    this.handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Code formatting
    this.handlebars.registerHelper('code', (language: string, content: string) => {
      return `\`\`\`${language}\n${content}\n\`\`\``;
    });

    // Iteration helpers
    this.handlebars.registerHelper('each', function(this: any, context: any, options: any) {
      let ret = "";
      if (context && context.length > 0) {
        for (let i = 0; i < context.length; i++) {
          ret = ret + options.fn({...context[i], '@index': i});
        }
      }
      return ret;
    });
  }

  private async fetchTemplateContent(source: TemplateSource): Promise<string> {
    const headers = this.buildAuthHeaders(source.auth);
    
    const response = await this.httpClient.get(source.url, { headers });
    
    if (response.headers['content-type']?.includes('application/json')) {
      // Handle JSON response (e.g., from API)
      const data = JSON.parse(response.data);
      return data.content || data.template || data;
    } else {
      // Raw template content
      return response.data;
    }
  }

  private async parseTemplate(content: string, source: TemplateSource): Promise<Template> {
    const { data, content: body } = matter(content);
    
    const id = this.generateTemplateId(data.name, data.version);
    const checksum = this.calculateChecksum(content);

    return {
      id,
      name: data.name,
      description: data.description || '',
      version: data.version,
      category: data.category || 'custom',
      source,
      content: body,
      variables: data.variables || [],
      metadata: {
        author: data.author,
        created: new Date(),
        updated: new Date(),
        tags: data.tags || []
      },
      checksum
    };
  }

  private validateRequiredVariables(template: Template, variables: Record<string, any>): void {
    const missing: string[] = [];
    
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in variables)) {
        missing.push(variable.name);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required variables: ${missing.join(', ')}`);
    }
  }

  private applyDefaults(template: Template, variables: Record<string, any>): Record<string, any> {
    const result = { ...variables };
    
    for (const variable of template.variables) {
      if (!(variable.name in result) && variable.default !== undefined) {
        result[variable.name] = variable.default;
      }
    }

    return result;
  }

  private performSecurityChecks(content: string, validation: ValidationResult): void {
    // Check for script injection
    if (/<script|<iframe|javascript:/i.test(content)) {
      validation.valid = false;
      validation.errors.push({
        type: 'security',
        message: 'Template contains potentially unsafe content'
      });
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /eval\s*\(/,
      /new\s+Function/,
      /__proto__/,
      /constructor\s*\[/
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        validation.warnings.push({
          type: 'security',
          message: `Template contains suspicious pattern: ${pattern}`
        });
      }
    }
  }

  private async saveTemplate(template: Template): Promise<void> {
    // Save to cache
    const cachePath = path.join(this.cacheDir, `${template.id}.json`);
    await fs.writeFile(cachePath, JSON.stringify(template, null, 2));

    // Add to registry
    const existingIndex = this.registry.templates.findIndex(t => t.id === template.id);
    if (existingIndex >= 0) {
      this.registry.templates[existingIndex] = template;
    } else {
      this.registry.templates.push(template);
    }

    await this.saveRegistry();
  }

  private async updateTemplate(id: string, templateData: any): Promise<void> {
    const existing = this.registry.templates.find(t => t.id === id);
    if (!existing) {
      throw new Error(`Template ${id} not found`);
    }

    // Fetch updated content
    const content = await this.fetchTemplateContent(existing.source);
    
    // Validate
    const validation = await this.validateTemplate(content);
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Parse and update
    const updated = await this.parseTemplate(content, existing.source);
    updated.id = id; // Keep existing ID
    updated.metadata.created = existing.metadata.created; // Preserve creation date

    await this.saveTemplate(updated);
  }

  private async loadRegistry(): Promise<void> {
    try {
      const data = await fs.readFile(this.registryPath, 'utf-8');
      const registry = JSON.parse(data);
      
      // Convert dates
      this.registry.templates = registry.templates.map((t: any) => ({
        ...t,
        metadata: {
          ...t.metadata,
          created: new Date(t.metadata.created),
          updated: new Date(t.metadata.updated)
        }
      }));

      this.registry.sources = registry.sources.map((s: any) => ({
        ...s,
        lastSync: s.lastSync ? new Date(s.lastSync) : undefined
      }));

      // Restore webhook configurations
      for (const source of this.registry.sources) {
        this.webhooks.set(source.id, source.config);
      }
    } catch (error) {
      // Registry doesn't exist yet, start with empty
      this.registry = { templates: [], sources: [] };
    }
  }

  private async saveRegistry(): Promise<void> {
    await fs.writeFile(this.registryPath, JSON.stringify(this.registry, null, 2));
  }

  private buildHeaders(webhook: WebhookConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'MCP-Template-Manager/1.0',
      'Accept': 'application/json',
      ...webhook.headers
    };

    if (webhook.authType === 'bearer' && webhook.authCredentials) {
      headers['Authorization'] = `Bearer ${webhook.authCredentials}`;
    } else if (webhook.authType === 'api-key' && webhook.authCredentials) {
      headers['X-API-Key'] = webhook.authCredentials;
    }

    return headers;
  }

  private buildAuthHeaders(auth?: AuthConfig): Record<string, string> {
    if (!auth || auth.type === 'none') {
      return {};
    }

    const headers: Record<string, string> = {};

    if (auth.type === 'bearer' && auth.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    } else if (auth.type === 'api-key' && auth.key) {
      headers[auth.header || 'X-API-Key'] = auth.key;
    }

    return headers;
  }

  private async fetchTemplatesFromSource(source: RegisteredSource): Promise<any[]> {
    const response = await this.httpClient.get(source.url, {
      headers: this.buildHeaders(source.config)
    });

    const data = JSON.parse(response.data);
    
    // Handle different response formats
    if (Array.isArray(data)) {
      return data;
    } else if (data.templates && Array.isArray(data.templates)) {
      return data.templates;
    } else if (data.results && Array.isArray(data.results)) {
      return data.results;
    } else {
      throw new Error('Unknown template list format');
    }
  }

  private async registerWithService(config: WebhookConfig): Promise<void> {
    if (!config.registrationEndpoint) return;

    await this.httpClient.post(config.registrationEndpoint, {
      url: process.env.WEBHOOK_CALLBACK_URL || 'https://your-server.com/webhooks/templates',
      events: ['template.created', 'template.updated'],
      secret: process.env.WEBHOOK_SECRET
    }, {
      headers: this.buildHeaders(config)
    });
  }

  private startSyncInterval(source: RegisteredSource): void {
    if (!source.config.syncInterval) return;

    setInterval(async () => {
      try {
        await this.syncTemplates();
      } catch (error) {
        console.error(`Failed to sync templates from ${source.name}:`, error);
      }
    }, source.config.syncInterval * 60 * 1000);
  }

  private generateTemplateId(name: string, version: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${slug}-${version.replace(/\./g, '-')}`;
  }

  private generateWebhookId(config: WebhookConfig): string {
    const hash = createHash('sha256');
    hash.update(config.url);
    hash.update(config.name);
    return `whk_${hash.digest('hex').substring(0, 12)}`;
  }

  private calculateChecksum(content: string): string {
    const hash = createHash('sha256');
    hash.update(content);
    return `sha256:${hash.digest('hex')}`;
  }

  private findWebhookByHeaders(headers: Record<string, string>): string | null {
    // Look for webhook ID in headers
    if (headers['x-webhook-id']) {
      return headers['x-webhook-id'];
    }

    // Try to match by signature or other identifying headers
    for (const [id, config] of this.webhooks.entries()) {
      if (config.headers) {
        const match = Object.entries(config.headers).every(([key, value]) => 
          headers[key.toLowerCase()] === value
        );
        if (match) return id;
      }
    }

    return null;
  }

  private verifyWebhookSignature(payload: any, signature: string, webhook: WebhookConfig): boolean {
    if (!process.env.WEBHOOK_SECRET) return false;

    const hash = createHash('sha256');
    hash.update(process.env.WEBHOOK_SECRET);
    hash.update(JSON.stringify(payload));
    const expected = `sha256=${hash.digest('hex')}`;

    return signature === expected;
  }

  private parseWebhookEvent(payload: any): any {
    // Handle different webhook formats
    if (payload.event) {
      return payload;
    } else if (payload.action) {
      // GitHub-style webhook
      return {
        event: `template.${payload.action}`,
        template: payload.template || payload.content,
        timestamp: new Date()
      };
    } else {
      // Generic format
      return {
        event: 'template.updated',
        template: payload,
        timestamp: new Date()
      };
    }
  }

  private async processWebhookEvent(event: any, webhook: WebhookConfig): Promise<void> {
    switch (event.event) {
      case 'template.created':
      case 'template.updated':
        if (webhook.autoImport) {
          await this.importTemplate({
            type: 'webhook',
            url: event.template.downloadUrl || `${webhook.url}/${event.template.id}`,
            auth: webhook.authType !== 'none' ? {
              type: webhook.authType,
              token: webhook.authCredentials
            } : undefined
          });
        }
        break;

      case 'template.deleted':
        const existing = this.registry.templates.find(t => 
          t.source.url === webhook.url && t.name === event.template.name
        );
        if (existing) {
          await this.deleteTemplate(existing.id);
        }
        break;
    }
  }
}