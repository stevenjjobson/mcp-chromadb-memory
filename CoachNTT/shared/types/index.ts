/**
 * CoachNTT Shared Types
 * Re-export all shared types for easy importing
 */

export * from './audio';
export * from './memory';

// Common types used across the platform
export interface CoachNTTConfig {
  server: {
    host: string;
    port: number;
    apiKey?: string;
  };
  features: {
    audio: boolean;
    codeIntelligence: boolean;
    sessionLogging: boolean;
    autoMemory: boolean;
  };
  ui: {
    theme?: 'light' | 'dark' | 'auto';
    showStatusBar: boolean;
    showActivityBar: boolean;
  };
}

export interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}