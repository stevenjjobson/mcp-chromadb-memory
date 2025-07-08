---
template: true
version: 1.0
name: "Problem Solution Template"
description: "Document a problem and its solution for future reference"
category: "solution"
variables:
  - name: problemTitle
    description: "Brief title of the problem"
    required: true
    type: string
  - name: problemDescription
    description: "Detailed description of the problem"
    required: true
    type: string
  - name: context
    description: "Context where this problem occurred"
    required: false
    type: string
  - name: solution
    description: "The solution that worked"
    required: true
    type: string
  - name: alternativeSolutions
    description: "Other solutions considered"
    required: false
    type: array
  - name: codeExample
    description: "Code demonstrating the solution"
    required: false
    type: string
  - name: language
    description: "Programming language for code example"
    required: false
    type: string
    default: "typescript"
  - name: references
    description: "Links to relevant resources"
    required: false
    type: array
  - name: tags
    description: "Tags for categorization"
    required: false
    type: array
    default: ["solution"]
tags: [solution, template]
---

# Solution: {{problemTitle}}

## Problem

{{problemDescription}}

{{#if context}}
### Context
{{context}}
{{/if}}

## Solution

{{solution}}

{{#if codeExample}}
### Implementation

```{{language}}
{{codeExample}}
```
{{/if}}

{{#if alternativeSolutions}}
## Alternative Solutions Considered

{{#each alternativeSolutions}}
{{@index}}. {{this}}
{{/each}}
{{/if}}

## Key Takeaways

- Problem identified: {{formatDate _system.date "YYYY-MM-DD"}}
- Solution type: {{#if codeExample}}Code-based{{else}}Conceptual{{/if}}
- Complexity: {{#if alternativeSolutions}}High (multiple options){{else}}Straightforward{{/if}}

{{#if references}}
## References

{{#each references}}
- {{this}}
{{/each}}
{{/if}}

---
*Solution documented on {{formatDate _system.date "YYYY-MM-DD HH:mm"}} in vault: {{_system.vault}}*

{{#if tags}}
Tags: {{#each tags}}#{{this}} {{/each}}
{{/if}}