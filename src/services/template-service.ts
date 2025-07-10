import { promises as fs } from 'fs';
import * as path from 'path';

export interface TemplateInfo {
  name: string;
  category: string;
  path: string;
  description: string;
}

export interface TemplateCategory {
  name: string;
  description: string;
  templates: string[];
}

/**
 * Service for managing CoachNTT templates in the core vault
 */
export class TemplateService {
  private readonly TEMPLATE_FOLDER_NAME = 'CoachNTT Templates Read Only';
  private templateRegistry: Map<string, TemplateInfo> = new Map();

  /**
   * Template categories to create
   */
  private readonly categories: TemplateCategory[] = [
    {
      name: 'Architecture',
      description: 'Software architecture patterns and principles',
      templates: ['Microservices Architecture', 'Event-Driven Architecture', 'Clean Architecture', 'API Design Best Practices']
    },
    {
      name: 'Authentication',
      description: 'Authentication and authorization patterns',
      templates: ['JWT Implementation', 'OAuth2 Flow', 'Session Management', 'Security Checklist']
    },
    {
      name: 'Testing',
      description: 'Testing strategies and patterns',
      templates: ['Unit Testing Patterns', 'Integration Testing Guide', 'E2E Testing Strategy', 'Test Data Management']
    },
    {
      name: 'DevOps',
      description: 'DevOps practices and configurations',
      templates: ['CI-CD Pipeline', 'Docker Best Practices', 'Kubernetes Deployment', 'Monitoring and Logging']
    },
    {
      name: 'Database',
      description: 'Database design and management',
      templates: ['Schema Design Principles', 'Migration Strategy', 'Query Optimization', 'NoSQL vs SQL Decision']
    },
    {
      name: 'Code Patterns',
      description: 'Common code patterns and practices',
      templates: ['Design Patterns Reference', 'Error Handling Patterns', 'Async Programming Patterns', 'Dependency Injection']
    },
    {
      name: 'Project Setup',
      description: 'Project initialization and setup guides',
      templates: ['New Project Checklist', 'Git Workflow', 'Code Review Guidelines', 'Documentation Standards']
    }
  ];

  /**
   * Ensure templates exist in the vault, create if missing
   */
  async ensureTemplatesExist(vaultPath: string): Promise<void> {
    const templatePath = path.join(vaultPath, this.TEMPLATE_FOLDER_NAME);
    
    try {
      // Check if template folder exists
      await fs.access(templatePath);
      console.log(`Template folder already exists at: ${templatePath}`);
      
      // Load existing templates into registry
      await this.loadTemplateRegistry(templatePath);
    } catch (error) {
      // Folder doesn't exist, create it
      console.log(`Creating template folder at: ${templatePath}`);
      await this.createFolderStructure(vaultPath);
      
      // Note: Actual template content will be added incrementally
      console.log('Template folder structure created. Templates will be populated incrementally.');
    }
  }

  /**
   * Create the folder structure for templates
   */
  async createFolderStructure(vaultPath: string): Promise<void> {
    const templatePath = path.join(vaultPath, this.TEMPLATE_FOLDER_NAME);
    
    // Create main template folder
    await fs.mkdir(templatePath, { recursive: true });
    
    // Create README
    const readmeContent = this.generateReadmeContent();
    await fs.writeFile(path.join(templatePath, 'README.md'), readmeContent);
    
    // Create category folders
    for (const category of this.categories) {
      const categoryPath = path.join(templatePath, category.name);
      await fs.mkdir(categoryPath, { recursive: true });
      
      // Create category README
      const categoryReadme = `# ${category.name} Templates\n\n${category.description}\n\n## Templates in this category:\n${category.templates.map(t => `- ${t}`).join('\n')}\n\n*Templates will be populated incrementally*`;
      await fs.writeFile(path.join(categoryPath, 'README.md'), categoryReadme);
    }
  }

  /**
   * Generate README content for the template folder
   */
  private generateReadmeContent(): string {
    return `# CoachNTT Templates Read Only

## Overview

This folder contains industry-standard templates and best practices that serve as your reference across all projects. These templates are designed to be:

- **Language Agnostic**: Examples in multiple languages where applicable
- **Framework Neutral**: Patterns that work across different frameworks
- **Production Ready**: Focus on scalable, maintainable solutions
- **Security First**: Built-in security considerations

## Categories

${this.categories.map(cat => `### ${cat.name}\n${cat.description}\n`).join('\n')}

## Usage

These templates are **read-only references**. To use them:

1. **Reference**: Read templates to understand best practices
2. **Copy**: Copy relevant sections to your project
3. **Adapt**: Modify to fit your specific needs
4. **Learn**: Use as learning resources

## Important Notes

- These are industry best practices, not rigid rules
- Always consider your specific context
- Security and performance implications are noted in each template
- Templates are incrementally added and improved

## Contributing

While this folder is marked "Read Only", you can:
- Create your own templates in a separate folder
- Suggest improvements through the project repository
- Share your adaptations with the team

---
*Generated by CoachNTT Platform - Your AI Development Partner*`;
  }

  /**
   * Load existing templates into the registry
   */
  private async loadTemplateRegistry(templatePath: string): Promise<void> {
    this.templateRegistry.clear();
    
    for (const category of this.categories) {
      const categoryPath = path.join(templatePath, category.name);
      
      try {
        const files = await fs.readdir(categoryPath);
        
        for (const file of files) {
          if (file.endsWith('.md') && file !== 'README.md') {
            const templateName = file.replace('.md', '');
            this.templateRegistry.set(templateName, {
              name: templateName,
              category: category.name,
              path: path.join(categoryPath, file),
              description: `${category.name} template: ${templateName}`
            });
          }
        }
      } catch (error) {
        // Category folder might not have templates yet
        console.log(`No templates found in ${category.name} yet`);
      }
    }
  }

  /**
   * Get list of all templates
   */
  async getTemplateList(): Promise<TemplateInfo[]> {
    return Array.from(this.templateRegistry.values());
  }

  /**
   * Get template by name
   */
  async getTemplate(templateName: string, vaultPath: string): Promise<string | null> {
    const templateInfo = this.templateRegistry.get(templateName);
    if (!templateInfo) {
      return null;
    }
    
    try {
      const content = await fs.readFile(templateInfo.path, 'utf-8');
      return content;
    } catch (error) {
      console.error(`Error reading template ${templateName}:`, error);
      return null;
    }
  }

  /**
   * Search templates by keyword
   */
  searchTemplates(keyword: string): TemplateInfo[] {
    const results: TemplateInfo[] = [];
    const searchTerm = keyword.toLowerCase();
    
    for (const template of this.templateRegistry.values()) {
      if (
        template.name.toLowerCase().includes(searchTerm) ||
        template.category.toLowerCase().includes(searchTerm) ||
        template.description.toLowerCase().includes(searchTerm)
      ) {
        results.push(template);
      }
    }
    
    return results;
  }

  /**
   * Get the template folder path
   */
  getTemplateFolderPath(vaultPath: string): string {
    return path.join(vaultPath, this.TEMPLATE_FOLDER_NAME);
  }
}