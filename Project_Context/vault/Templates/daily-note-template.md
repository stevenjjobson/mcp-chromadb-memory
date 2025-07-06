---
template: true
version: 1.0
name: "Daily Note Template"
description: "Daily development journal and task tracking"
category: "daily"
variables:
  - name: date
    description: "Date of the daily note"
    required: true
    type: date
    default: "{{_system.date}}"
  - name: weather
    description: "Weather/mood indicator"
    required: false
    type: string
    default: "☀️"
  - name: activeProjects
    description: "List of active projects"
    required: false
    type: array
    default: []
  - name: focusArea
    description: "Main focus for today"
    required: false
    type: string
inheritance:
  extends: "journal-base"
  variables: "merge"
tags: [daily, journal, tasks]
---

# Daily Note - {{formatDate date "dddd, MMMM DD, YYYY"}}

**Weather/Mood**: {{weather}}  
**Start Time**: {{formatDate _system.date "HH:mm"}}  
**Focus**: {{#if focusArea}}{{focusArea}}{{else}}_Set your focus for today_{{/if}}

## 🎯 Daily Objectives

- [ ] Primary objective for today
- [ ] Secondary objective
- [ ] Nice-to-have task

## 📋 Task List

### High Priority
- [ ] Task 1
- [ ] Task 2

### Medium Priority
- [ ] Task 3
- [ ] Task 4

### Low Priority
- [ ] Task 5

## 🚀 Active Projects

{{#if activeProjects}}
{{#each activeProjects}}
### [[10-Active-Projects/{{this}}/project-overview|{{this}}]]
- [ ] Project task 1
- [ ] Project task 2
{{/each}}
{{else}}
### No active projects linked
_Link your active projects here_
{{/if}}

## 💡 Ideas & Thoughts

- Idea 1
- Thought about improving X

## 🐛 Issues Encountered

### Issue 1
- **Problem**: Description
- **Solution**: How it was resolved
- **Reference**: [[90-Troubleshooting/solution-xyz]]

## 📚 Learning Notes

### What I Learned Today
- New concept or technique
- Interesting discovery

### Resources Consulted
- [Resource 1](url)
- [[50-Learning-Resources/tutorial-abc]]

## 💻 Code Snippets

### Snippet: Quick Solution
```javascript
// Useful code from today
const solution = () => {
    // Implementation
};
```
_Saved to: [[40-Code-Library/41-Snippets/javascript/snippet-name]]_

## 🔄 Standup Notes

### Yesterday
- Completed X
- Made progress on Y

### Today
- Working on A
- Planning to finish B

### Blockers
- None / Waiting for...

## 📊 Progress Tracking

| Project | Progress | Notes |
|---------|----------|-------|
| Project A | 75% | On track |
| Project B | 40% | Slightly behind |

## 🎉 Wins

- ✅ Successfully implemented feature X
- ✅ Fixed long-standing bug in Y
- ✅ Learned new technique Z

## 📝 Meeting Notes

### Meeting: Team Standup
- **Time**: 10:00 AM
- **Attendees**: Team
- **Key Points**: 
  - Discussion point 1
  - Decision made
- **Action Items**:
  - [ ] Follow up on X

_Full notes: [[80-Team-Collaboration/meetings/{{formatDate date "YYYY-MM-DD"}}-standup]]_

## 🔗 Related Notes

- [[70-Task-Management/71-Daily-Notes/{{formatDate (date.subtract 1 'day') "YYYY-MM-DD"}}|Yesterday's Note]]
- [[70-Task-Management/71-Daily-Notes/{{formatDate (date.add 1 'day') "YYYY-MM-DD"}}|Tomorrow's Note]]
- [[70-Task-Management/74-Reviews/weekly-review-{{formatDate date "YYYY-[W]WW"}}|This Week's Review]]

## 📅 Tomorrow's Plan

- [ ] Priority task for tomorrow
- [ ] Follow up on today's blockers
- [ ] Prepare for meeting

## 🌙 End of Day Reflection

**Productivity**: ⭐⭐⭐⭐☆  
**Mood**: 😊  
**Energy Level**: 7/10

### What went well?
- 

### What could be improved?
- 

### Key Takeaway
- 

---
**End Time**: _Update at EOD_  
**Total Hours**: _Calculate_  
**Tags**: #daily-note #journal {{formatDate date "#YYYY/MM/DD"}} {{#each activeProjects}}#project/{{lowercase this}} {{/each}}