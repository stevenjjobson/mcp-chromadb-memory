/**
 * Simple logger service for CoachNTT MCP Server
 */

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

class ConsoleLogger implements Logger {
  private prefix = '[CoachNTT]';

  info(message: string, ...args: any[]): void {
    console.log(`${this.prefix} INFO:`, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`${this.prefix} WARN:`, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`${this.prefix} ERROR:`, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.DEBUG) {
      console.debug(`${this.prefix} DEBUG:`, message, ...args);
    }
  }
}

export const logger = new ConsoleLogger();