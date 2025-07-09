/**
 * Metadata validation utilities for ChromaDB compatibility
 * ChromaDB only accepts string, number, boolean, or null values in metadata
 */

/**
 * Validates and sanitizes metadata for ChromaDB storage
 * Converts complex objects to JSON strings and removes invalid values
 */
export function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) {
      sanitized[key] = null;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value) || typeof value === 'object') {
      // Convert complex objects to JSON strings
      try {
        sanitized[key] = JSON.stringify(value);
      } catch (error) {
        console.warn(`Failed to stringify metadata value for key "${key}":`, error);
        // Skip this field if it can't be stringified
      }
    } else {
      console.warn(`Skipping invalid metadata type for key "${key}": ${typeof value}`);
    }
  }
  
  return sanitized;
}

/**
 * Validates if a metadata object is ChromaDB compliant
 */
export function isValidMetadata(metadata: Record<string, any>): boolean {
  for (const value of Object.values(metadata)) {
    if (value !== null && 
        typeof value !== 'string' && 
        typeof value !== 'number' && 
        typeof value !== 'boolean') {
      return false;
    }
  }
  return true;
}

/**
 * Extracts complex data from metadata and returns both sanitized metadata and extracted data
 */
export function extractComplexData(metadata: Record<string, any>): {
  sanitized: Record<string, any>;
  extracted: Record<string, any>;
} {
  const sanitized: Record<string, any> = {};
  const extracted: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) {
      sanitized[key] = null;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else {
      // Store complex data separately
      extracted[key] = value;
      // Optionally add a reference in sanitized metadata
      sanitized[`${key}_type`] = Array.isArray(value) ? 'array' : 'object';
    }
  }
  
  return { sanitized, extracted };
}