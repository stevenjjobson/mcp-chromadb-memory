# VS Code Extension UI Design

## Design Principles

1. **Familiarity**: Follow VS Code's design language and patterns
2. **Discoverability**: Make features easy to find and understand
3. **Performance**: UI should be responsive and non-blocking
4. **Accessibility**: Support screen readers and keyboard navigation
5. **Progressive Disclosure**: Show advanced features as needed

## Visual Design System

### Color Palette
```css
/* Primary Colors - Following VS Code theme variables */
--cognitive-primary: var(--vscode-button-background);
--cognitive-accent: var(--vscode-notificationsInfoIcon-foreground);
--cognitive-success: var(--vscode-testing-iconPassed);
--cognitive-warning: var(--vscode-editorWarning-foreground);
--cognitive-error: var(--vscode-editorError-foreground);

/* Semantic Colors */
--memory-recent: var(--vscode-gitDecoration-modifiedResourceForeground);
--memory-important: var(--vscode-debugTokenExpression-name);
--state-active: var(--vscode-charts-green);
--vault-active: var(--vscode-badge-background);
```

### Icons
- Use VS Code's Codicon library for consistency
- Custom icons only when necessary
- Meaningful and recognizable symbols

```
$(database) - Memory storage
$(history) - State timeline
$(folder-library) - Vault
$(search) - Memory search
$(sync) - State capture
$(cloud-upload) - Backup
```

## Component Designs

### Status Bar

#### Design
```
[$(database) ChromaDB: Connected] [$(folder-library) Vault: MyProject] [$(history) Last State: 2h ago]
```

#### States
- **Connected**: Green indicator, show server info
- **Connecting**: Yellow with spinner animation
- **Disconnected**: Red with reconnect action
- **Error**: Red with error details on hover

#### Interactions
- Click to show connection menu
- Hover for detailed information
- Right-click for quick actions

### Activity Bar Icon

#### Design
- Custom brain icon with subtle animation
- Badge showing memory count
- Tooltip with quick stats

```
🧠 Cognitive Memory
   Badge: 1.2k
```

### Memory Explorer

#### Tree Structure
```
🧠 COGNITIVE MEMORY
├── 📊 Overview
│   ├── Total Memories: 1,247
│   ├── Active Vault: MyProject
│   └── Last Sync: 2 min ago
├── 🕐 Recent (24h)
│   ├── ● Fixed authentication bug
│   ├── ● Updated user service
│   └── ● Refactored database layer
├── ⭐ Important
│   ├── Critical security fix
│   └── Architecture decision
├── 🏷️ By Category
│   ├── 📝 code_snippet (234)
│   ├── 🔧 task_critical (45)
│   ├── 👤 user_preference (23)
│   └── 📚 documentation (67)
└── 🔍 Search Memories...
```

#### Item Design
```
┌─────────────────────────────────┐
│ ● Fixed authentication bug      │
│   2 hours ago | auth.service.ts │
│   Importance: ████████░░ 80%    │
└─────────────────────────────────┘
```

#### Actions
- **Click**: Show memory details
- **Double-click**: Navigate to file/line
- **Right-click**: Context menu
  - View Details
  - Copy Content
  - Delete Memory
  - Find Similar

### State Timeline

#### Calendar View
```
┌─────────────────────────────────┐
│ ◄ November 2024 ►               │
├─────────────────────────────────┤
│ Su Mo Tu We Th Fr Sa           │
│              1  2  3            │
│  4  5  6  7  8  9 10           │
│ 11 12 13 14 15 16 17           │
│ 18 19 20 21 22 23 24           │
│ 25 26 27 28 29 30              │
└─────────────────────────────────┘

Legend: ● Has states ○ No states
```

#### Timeline View
```
┌─────────────────────────────────┐
│ Today - November 28, 2024       │
├─────────────────────────────────┤
│ 14:30 ● Pre-deployment check    │
│ 12:15 ● After bug fix           │
│ 10:00 ● Morning session start   │
│                                 │
│ Yesterday - November 27         │
│ 18:45 ● End of day backup       │
│ 16:30 ● Feature complete        │
└─────────────────────────────────┘
```

#### State Preview
```
┌─────────────────────────────────┐
│ State: Pre-deployment check     │
├─────────────────────────────────┤
│ 📁 Files: 47 modified           │
│ 🧠 Memories: 1,232 total        │
│ 🌿 Branch: feature/auth-fix     │
│ 📝 Description:                 │
│ "Captured before deploying      │
│  authentication fixes"          │
├─────────────────────────────────┤
│ [Preview] [Restore] [Compare]   │
└─────────────────────────────────┘
```

### Search Interface

#### Quick Search (Command Palette)
```
> Search Memories: authentication
┌─────────────────────────────────┐
│ 🔍 authentication               │
├─────────────────────────────────┤
│ ► Fixed authentication bug      │
│   auth.service.ts • 2 hours ago │
│                                 │
│ ► JWT token validation update   │
│   middleware/auth.js • 1 day    │
│                                 │
│ ► OAuth2 implementation         │
│   oauth.config.ts • 3 days      │
└─────────────────────────────────┘
```

#### Advanced Search Panel
```
┌─────────────────────────────────┐
│ 🔍 Memory Search                │
├─────────────────────────────────┤
│ Query: [                      ] │
│                                 │
│ Filters:                        │
│ ☑ Code Snippets  ☑ Critical    │
│ ☐ Documentation  ☐ Preferences  │
│                                 │
│ Date Range:                     │
│ [Last 7 days          ▼]        │
│                                 │
│ Search Type:                    │
│ ○ Semantic  ● Hybrid  ○ Exact  │
├─────────────────────────────────┤
│ Results (15)              Sort ▼│
├─────────────────────────────────┤
│ [Result items...]               │
└─────────────────────────────────┘
```

### Vault Manager

#### Vault List
```
┌─────────────────────────────────┐
│ 📚 Vault Manager                │
├─────────────────────────────────┤
│ ● MyProject (Active)            │
│   Type: Project | 1,247 memories│
│   Path: ~/projects/myproject    │
│                                 │
│ ○ Personal Notes                │
│   Type: Personal | 432 memories │
│   Path: ~/obsidian/personal     │
│                                 │
│ ○ Team Knowledge                │
│   Type: Team | 3,891 memories   │
│   Path: ~/team/shared           │
├─────────────────────────────────┤
│ [+ New Vault] [⚙️ Settings]     │
└─────────────────────────────────┘
```

### Editor Integration

#### CodeLens
```typescript
// app.service.ts

// 🧠 12 memories | Last: 2 days ago | View History
export class AppService {
  
  // 💡 3 similar implementations found
  async processData(input: DataInput) {
    // implementation
  }
}
```

#### Hover Information
```
┌─────────────────────────────────┐
│ processData                     │
├─────────────────────────────────┤
│ 🧠 Related Memories (3)         │
│                                 │
│ • Optimized version (2 days)    │
│   "Used parallel processing..."  │
│                                 │
│ • Original implementation (1w)   │
│   "Simple sequential approach"   │
│                                 │
│ • Performance fix (3w)          │
│   "Added caching layer"         │
├─────────────────────────────────┤
│ [View All] [Compare]            │
└─────────────────────────────────┘
```

#### Inline Suggestions
```typescript
function calculateTotal(items) {
  // As you type...
  
  // 💡 Memory suggestion:
  // return items.reduce((sum, item) => sum + item.price, 0);
  //       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  // From: "Order calculation refactor" (1 week ago)
  // Accept: Tab | Reject: Esc | More: Ctrl+Space
}
```

## Notification Design

### Success Notifications
```
┌─────────────────────────────────┐
│ ✅ Memory stored successfully   │
│ "Fixed authentication bug"      │
│ [View] [Dismiss]                │
└─────────────────────────────────┘
```

### Progress Notifications
```
┌─────────────────────────────────┐
│ 🔄 Capturing state...           │
│ ████████████░░░░░░░ 65%         │
│ Processing 47 files             │
└─────────────────────────────────┘
```

### Error Notifications
```
┌─────────────────────────────────┐
│ ❌ Connection failed            │
│ Unable to reach MCP server      │
│ [Retry] [Settings] [Dismiss]    │
└─────────────────────────────────┘
```

## Settings UI

### Extension Settings
```
Cognitive Memory Settings

Connection
├─ Server URL: [localhost:3000        ]
├─ ☑ Auto-connect on startup
└─ Retry attempts: [5    ]

Auto-capture
├─ ☑ Capture on commit
├─ ☑ Capture on debug
├─ ☐ Capture hourly
└─ Min. changes: [10   ]

UI Preferences
├─ ☑ Show status bar
├─ ☑ Show CodeLens
├─ Default view: [Tree View    ▼]
└─ Theme: [Auto ▼]
```

## Responsive Design

### Sidebar Width Adaptation
- **Narrow** (<200px): Icons only with tooltips
- **Medium** (200-300px): Abbreviated text
- **Wide** (>300px): Full text and details

### Performance Considerations
- Virtual scrolling for long lists
- Lazy loading of tree items
- Debounced search input
- Progressive image loading

## Accessibility

### Keyboard Navigation
- `Tab`: Navigate between elements
- `Enter`: Activate default action
- `Space`: Toggle selection
- `Escape`: Close dialogs/panels
- `Ctrl+F`: Focus search

### Screen Reader Support
- Meaningful ARIA labels
- Role attributes
- Live regions for updates
- Descriptive button text

### High Contrast Support
- Respect VS Code theme
- Sufficient color contrast
- Don't rely on color alone
- Clear focus indicators

## Animation and Transitions

### Loading States
```css
@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}

.loading {
  animation: pulse 1.5s ease-in-out infinite;
}
```

### State Changes
- Smooth transitions (200ms)
- Subtle fade effects
- No jarring movements
- Respect reduced motion preference

## Mobile Considerations

While VS Code is primarily desktop, consider:
- Touch-friendly hit targets (min 44px)
- Readable font sizes
- Scrollable containers
- Responsive layouts

## Design System Integration

### Following VS Code Patterns
- Use built-in components when possible
- Match existing interaction patterns
- Consistent spacing and sizing
- Familiar iconography

### Custom Components
- Only when necessary
- Document deviations
- Maintain consistency
- Test across themes

## Mockup Tools

### Recommended Tools
- Figma: Collaborative design
- Sketch: macOS design tool
- Adobe XD: Prototyping
- VS Code itself: Live mockups

### Design Resources
- [VS Code Icons](https://microsoft.github.io/vscode-codicons/dist/codicon.html)
- [VS Code Theme Colors](https://code.visualstudio.com/api/references/theme-color)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)