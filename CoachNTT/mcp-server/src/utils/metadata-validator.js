/**
 * Metadata validator utility
 */

export function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    // Skip null, undefined, or function values
    if (value === null || value === undefined || typeof value === 'function') {
      continue;
    }
    
    // Convert non-string primitives to strings
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = String(value);
    }
    // Handle arrays
    else if (Array.isArray(value)) {
      sanitized[key] = value.filter(v => v !== null && v !== undefined).map(v => String(v));
    }
    // Handle nested objects (flatten to string representation)
    else if (typeof value === 'object') {
      sanitized[key] = JSON.stringify(value);
    }
  }
  
  return sanitized;
}