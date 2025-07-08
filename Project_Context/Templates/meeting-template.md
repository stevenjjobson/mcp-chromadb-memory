---
template: true
version: 1.0
name: "Meeting Notes Template"
description: "Capture meeting discussions, decisions, and action items"
category: "meeting"
variables:
  - name: meetingTitle
    description: "Meeting title or purpose"
    required: true
    type: string
  - name: meetingDate
    description: "Date of the meeting"
    required: true
    type: date
    default: "{{_system.date}}"
  - name: attendees
    description: "List of attendees"
    required: true
    type: array
  - name: agenda
    description: "Meeting agenda items"
    required: false
    type: array
  - name: discussions
    description: "Key discussion points"
    required: true
    type: array
  - name: decisions
    description: "Decisions made during meeting"
    required: false
    type: array
  - name: actionItems
    description: "Action items with assignees"
    required: false
    type: array
  - name: nextSteps
    description: "Next steps or follow-up"
    required: false
    type: string
  - name: recordingLink
    description: "Link to meeting recording"
    required: false
    type: string
tags: [meeting, collaboration]
---

# Meeting: {{meetingTitle}}

**Date**: {{formatDate meetingDate "MMMM DD, YYYY"}}  
**Time**: {{formatDate meetingDate "HH:mm"}}  
**Attendees**: {{join attendees ", "}}

{{#if recordingLink}}
**Recording**: [Meeting Recording]({{recordingLink}})
{{/if}}

## Agenda

{{#if agenda}}
{{#each agenda}}
{{@index}}. {{this}}
{{/each}}
{{else}}
*No formal agenda provided*
{{/if}}

## Discussion Points

{{#each discussions}}
### {{@index}}. {{this.topic}}
{{this.notes}}

{{#if this.keyPoints}}
**Key Points**:
{{#each this.keyPoints}}
- {{this}}
{{/each}}
{{/if}}
{{/each}}

{{#if decisions}}
## Decisions Made

{{#each decisions}}
- **{{this.decision}}**
  - Rationale: {{this.rationale}}
  - Impact: {{this.impact}}
{{/each}}
{{/if}}

{{#if actionItems}}
## Action Items

| Action | Assignee | Due Date | Status |
|--------|----------|----------|---------|
{{#each actionItems}}
| {{this.action}} | {{this.assignee}} | {{formatDate this.dueDate "MM/DD/YYYY"}} | {{this.status}} |
{{/each}}
{{/if}}

{{#if nextSteps}}
## Next Steps

{{nextSteps}}
{{/if}}

## Meeting Metrics

- **Duration**: Calculated from calendar
- **Decisions**: {{#if decisions}}{{decisions.length}}{{else}}0{{/if}}
- **Action Items**: {{#if actionItems}}{{actionItems.length}}{{else}}0{{/if}}
- **Follow-up Required**: {{#if actionItems}}Yes{{else}}No{{/if}}

---
*Meeting notes captured on {{formatDate _system.date "YYYY-MM-DD HH:mm"}}*  
*Vault: [[{{_system.vault}}]]*