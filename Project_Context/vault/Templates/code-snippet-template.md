---
template: true
version: 1.0
name: "Code Snippet Template"
description: "Template for documenting reusable code snippets"
category: "snippet"
variables:
  - name: snippetTitle
    description: "Title of the code snippet"
    required: true
    type: string
  - name: language
    description: "Programming language"
    required: true
    type: string
  - name: purpose
    description: "What this code solves"
    required: true
    type: string
  - name: pattern
    description: "Design pattern or type"
    required: false
    type: string
    default: "utility"
  - name: complexity
    description: "Time complexity"
    required: false
    type: string
    default: "O(n)"
  - name: tags
    description: "Additional tags"
    required: false
    type: array
    default: []
tags: [snippet, code, template]
---

# {{snippetTitle}}

**Language**: {{capitalize language}}  
**Pattern**: {{pattern}}  
**Created**: {{formatDate _system.date "YYYY-MM-DD"}}  
**Complexity**: {{complexity}}

## Purpose

{{purpose}}

## Implementation

```{{lowercase language}}
// {{snippetTitle}}
// Purpose: {{purpose}}

// Implementation goes here
function example() {
    // Add your code
}
```

## Usage Example

```{{lowercase language}}
// Example usage of {{snippetTitle}}

// Show how to use the snippet
const result = example();
console.log(result);
```

## Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `param1` | `type` | Description | `undefined` |
| `param2` | `type` | Description | `null` |

## Returns

- **Type**: `ReturnType`
- **Description**: What the function/snippet returns

## Edge Cases

1. **Empty Input**: Handle gracefully
2. **Invalid Types**: Type check and throw error
3. **Performance**: Consider large datasets

## Performance Analysis

- **Time Complexity**: {{complexity}}
- **Space Complexity**: O(1)
- **Best Case**: O(1)
- **Worst Case**: {{complexity}}

### Benchmarks
```{{lowercase language}}
// Benchmark results
// Input size: 1000 - Time: 0.5ms
// Input size: 10000 - Time: 5ms
// Input size: 100000 - Time: 50ms
```

## Variations

### Variation 1: Optimized Version
```{{lowercase language}}
// Optimized implementation
```

### Variation 2: Functional Approach
```{{lowercase language}}
// Functional programming version
```

## Common Mistakes

1. **Mistake**: Not checking for null values
   - **Fix**: Add null checks before processing

2. **Mistake**: Mutating input parameters
   - **Fix**: Create copies of inputs

## Testing

```{{lowercase language}}
// Unit tests
describe('{{snippetTitle}}', () => {
    test('should handle basic case', () => {
        // Test implementation
    });
    
    test('should handle edge cases', () => {
        // Edge case tests
    });
});
```

## Related Patterns

- [[similar-pattern-1|Similar Pattern 1]] - Alternative approach
- [[similar-pattern-2|Similar Pattern 2]] - Related implementation
- [[design-pattern|Design Pattern]] - Theoretical background

## References

- [MDN Documentation](https://developer.mozilla.org/)
- [Language Specification](url)
- [[20-Development-Stack/21-Languages/{{lowercase language}}/best-practices|{{language}} Best Practices]]

## Version History

- **v1.0** ({{formatDate _system.date "YYYY-MM-DD"}}): Initial implementation
- **v1.1**: Performance optimization
- **v1.2**: Added error handling

---
**File**: `snippet-{{lowercase language}}-{{dashCase snippetTitle}}.md`  
**Location**: [[40-Code-Library/41-Snippets/{{lowercase language}}]]  
**Tags**: #snippet #lang/{{lowercase language}} #pattern/{{lowercase pattern}} {{#each tags}}#{{this}} {{/each}}