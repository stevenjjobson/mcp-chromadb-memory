# File Search Guide

The Code Intelligence system now includes comprehensive file and folder indexing capabilities, providing fast database-backed file searches without filesystem traversal.

## New Features

### File and Folder Indexing
When you run `index_codebase`, the system now:
- Indexes all directories in the codebase hierarchy
- Stores file metadata (name, path, size, modification time)
- Tracks file types (code, config, documentation, asset, test, other)
- Counts symbols per file
- Maintains parent-child directory relationships

### New Tools

#### `find_files`
Fast database search for files by various criteria:
```
find_files name="config" extension=".ts" fileType="code" limit=20
```

Parameters:
- `name`: File name or partial name (case-insensitive)
- `extension`: File extension (e.g., ".ts", ".js")
- `directory`: Directory path or partial path
- `fileType`: Type of file (code/config/documentation/asset/test/other)
- `limit`: Maximum results (default: 50)

#### `explore_folder`
Browse directory contents with statistics:
```
explore_folder path="/src/components" recursive=true showStats=true
```

Parameters:
- `path`: Directory path to explore
- `recursive`: Include all subdirectories (default: false)
- `showStats`: Show file statistics (default: true)

## Performance Benefits

### Traditional Glob
- Traverses filesystem for every search
- Returns only file paths
- Can be slow on large codebases
- No metadata or relationships

### Code Intelligence File Search
- Instant PostgreSQL queries
- Rich metadata (size, type, symbol count)
- File relationships (imports, tests)
- Hierarchical directory structure
- No filesystem traversal needed

## Usage Examples

### Find all TypeScript config files
```
find_files name="config" extension=".ts"
```

### Browse a specific directory
```
explore_folder path="/src" showStats=true
```

### Find test files
```
find_files fileType="test"
```

### Search in a specific directory
```
find_files directory="/src/utils" extension=".ts"
```

## Hook Integration

The Glob tool hook now suggests these file search tools when appropriate:
- For code file patterns: Suggests `index_codebase` then `find_files`
- For specific filename searches: Suggests `find_files`
- For directory browsing: Suggests `explore_folder`

## Database Schema

The system uses two new PostgreSQL tables:

1. **project_files**: Stores file and directory information
   - Full paths and hierarchical structure
   - File metadata and statistics
   - Symbol counts and relationships

2. **file_relationships**: Tracks file dependencies
   - Import/include relationships
   - Test file associations
   - Configuration linkages

## Best Practices

1. **Index First**: Run `index_codebase` on your project to populate the file database
2. **Use Specific Searches**: The more specific your criteria, the faster the results
3. **Leverage File Types**: Use `fileType` parameter to quickly filter by category
4. **Explore Hierarchically**: Use `explore_folder` with `recursive=false` for better overview

## Integration with Symbol Search

File search complements symbol search:
- Find files containing specific symbols
- Browse files in a directory and see symbol counts
- Track which files import/export specific modules
- Understand project structure at both file and symbol level