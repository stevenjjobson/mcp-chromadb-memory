/**
 * Retry helper utilities for handling transient failures
 */

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

/**
 * Default function to determine if an error is retryable
 */
function defaultShouldRetry(error: any): boolean {
  // Retry on connection errors
  if (error.message?.includes('Unable to connect') || 
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('ECONNRESET')) {
    return true;
  }
  
  // Retry on rate limiting errors
  if (error.status === 429 || error.message?.includes('rate limit')) {
    return true;
  }
  
  // Don't retry on other errors
  return false;
}

/**
 * Execute a function with exponential backoff retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs = 60000,
    backoffMultiplier = 2,
    shouldRetry = defaultShouldRetry
  } = options;
  
  let lastError: any;
  let delay = initialDelayMs;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      
      // Log retry attempt
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Attempt ${attempt} failed, retrying in ${delay}ms:`, errorMessage);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Calculate next delay with exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }
  
  throw lastError;
}

/**
 * Process items in batches with rate limiting
 */
export async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  batchDelayMs: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    try {
      const batchResults = await processor(batch);
      results.push(...batchResults);
    } catch (error) {
      console.error(`Batch processing failed at index ${i}:`, error);
      throw error;
    }
    
    // Add delay between batches (except for the last batch)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelayMs));
    }
  }
  
  return results;
}