# Claude Desktop Configuration Examples

This directory contains example configuration files for Claude Desktop MCP server integration.

## ⚠️ Security Notice

**NEVER commit configuration files with real API keys to version control!**

Always use placeholders like `YOUR_OPENAI_API_KEY_HERE` in example files.

## 📄 Configuration Files

### Main Example
- `claude_desktop_config_example.json` - Comprehensive example with all features

### Specific Configurations
- `claude_desktop_config_coachntt.json` - CoachNTT audio implementation
- `claude_desktop_config_dual_vault.json` - Dual vault architecture setup
- `claude_desktop_config_fixed.json` - Single vault configuration
- `claude_desktop_config_current_SANITIZED.json` - Current production config (sanitized)

## 🔧 Usage

1. Copy the appropriate example file to your Claude Desktop config location:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. Replace placeholder values:
   - `YOUR_OPENAI_API_KEY_HERE` - Your OpenAI API key
   - `YOUR_ELEVENLABS_API_KEY_HERE` - Your ElevenLabs API key (for audio)
   - `C:/path/to/your/...` - Actual paths on your system

3. Ensure Docker containers are running:
   ```bash
   docker-compose up -d chromadb postgres
   ```

## 🔑 Environment Variables

### Required
- `OPENAI_API_KEY` - For generating embeddings
- `DOCKER_CONTAINER=true` - When running in Docker
- Database connection settings (CHROMA_*, POSTGRES_*)

### Optional Features
- `VAULT_MODE=dual` - Enable dual vault architecture
- `CODE_INDEXING_ENABLED=true` - Enable code intelligence
- `AUTO_START_SESSION_LOGGING=true` - Auto-start session logging
- `ELEVENLABS_API_KEY` - For audio synthesis (CoachNTT)

## 📚 Documentation

For detailed configuration instructions, see:
- [Claude Desktop Config Guide](../../guides/claude-desktop-config.md)
- [MCP Configuration Guide](../../guides/mcp-configuration-guide.md)
- [Dual Vault Quick Start](../../guides/dual-vault-quickstart.md)