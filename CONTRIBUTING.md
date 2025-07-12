# Contributing to MCP ChromaDB Memory Server

First off, thank you for considering contributing to this project! 🎉

## 🚀 Platform v2.1 Development

We're currently transforming this project into a comprehensive **Cognitive State Management Platform** with advanced code intelligence features. This is an exciting time to contribute! See our [Implementation Roadmap](./vault/Planning/roadmaps/Implementation%20Roadmap.md) for the full vision.

### Current Focus Areas
- Code intelligence system (symbol indexing and streaming search)
- Hierarchical memory system (3-tier architecture)
- Multi-project vault management
- State capture and restoration
- Pattern recognition and learning
- Background optimization services

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Include logs and error messages**
- **Describe the behavior you observed and what you expected**
- **Include your environment details** (OS, Node version, Docker version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**
- **List any alternative solutions you've considered**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code lints
5. Update documentation as needed
6. Issue that pull request!

## Development Process

### Working on Platform v2.1

1. **Setup your development environment**
   ```bash
   git clone https://github.com/yourusername/mcp-chromadb-memory.git
   cd mcp-chromadb-memory
   
   # Platform development happens on this branch
   git checkout feature/platform-foundation
   git pull origin feature/platform-foundation
   
   npm install
   ```

2. **Create a feature branch**
   ```bash
   # Branch from platform transformation, not main
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation

3. **Test your changes**
   ```bash
   npm run build
   npm test
   npm run inspect  # Test with MCP Inspector
   ```

4. **Commit your changes**
   - Use clear, descriptive commit messages
   - Reference issues and pull requests when relevant

## Code Style Guidelines

- Use TypeScript for all new code
- Follow the existing formatting (2 spaces, no tabs)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

## Testing Guidelines

- Write unit tests for new functionality
- Ensure all tests pass before submitting PR
- Test with both local and Docker setups
- Verify ChromaDB integration works correctly

## Documentation

- Update README.md for user-facing changes
- Update CLAUDE.md for AI-specific guidance
- Add inline comments for complex logic
- Update API documentation for new tools

## Questions?

Feel free to open an issue with your question or reach out through GitHub discussions.