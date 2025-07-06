import fetch, { RequestInit, Response } from 'node-fetch';
import { z } from 'zod';

export interface HttpResponse {
  status: number;
  data: string;
  headers: Record<string, string>;
}

export interface HttpOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
}

export class HttpClient {
  private defaultTimeout: number;
  private maxRetries: number;

  constructor(config: { timeout?: number; maxRetries?: number } = {}) {
    this.defaultTimeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
  }

  async get(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
    const urlObj = new URL(url);
    
    // Add query parameters
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        urlObj.searchParams.append(key, value);
      });
    }

    return this.request(urlObj.toString(), {
      method: 'GET',
      headers: options.headers,
      timeout: options.timeout || this.defaultTimeout
    }, options.maxRetries || this.maxRetries);
  }

  async post(url: string, body: any, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(body),
      timeout: options.timeout || this.defaultTimeout
    }, options.maxRetries || this.maxRetries);
  }

  async put(url: string, body: any, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(body),
      timeout: options.timeout || this.defaultTimeout
    }, options.maxRetries || this.maxRetries);
  }

  async delete(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request(url, {
      method: 'DELETE',
      headers: options.headers,
      timeout: options.timeout || this.defaultTimeout
    }, options.maxRetries || this.maxRetries);
  }

  private async request(
    url: string, 
    options: RequestInit & { timeout?: number }, 
    maxRetries: number
  ): Promise<HttpResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout!);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.text();
        
        // Convert headers to plain object
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });

        // Throw for non-2xx status codes (will trigger retry)
        if (!response.ok && attempt < maxRetries) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return {
          status: response.status,
          data,
          headers
        };
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${options.timeout}ms`);
        }
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  // Utility method for webhook signature verification
  static verifyWebhookSignature(
    payload: string, 
    signature: string, 
    secret: string,
    algorithm: 'sha256' | 'sha1' = 'sha256'
  ): boolean {
    const crypto = require('crypto');
    const hash = crypto.createHmac(algorithm, secret);
    hash.update(payload);
    const expected = `${algorithm}=${hash.digest('hex')}`;
    
    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  // Rate limiting helper
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();

  async checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const limiter = this.rateLimiters.get(key);

    if (!limiter || now > limiter.resetTime) {
      this.rateLimiters.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }

    if (limiter.count >= limit) {
      return false;
    }

    limiter.count++;
    return true;
  }
}