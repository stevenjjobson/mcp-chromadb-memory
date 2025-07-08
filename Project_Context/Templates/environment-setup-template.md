---
template: true
version: 1.0
name: "Environment Setup Template"
description: "Comprehensive development environment setup guide"
category: "setup"
variables:
  - name: technology
    description: "Technology being set up"
    required: true
    type: string
  - name: version
    description: "Recommended version"
    required: true
    type: string
  - name: operatingSystem
    description: "Target OS (Windows, macOS, Linux)"
    required: false
    type: string
    default: "cross-platform"
  - name: prerequisites
    description: "Required prerequisites"
    required: false
    type: array
    default: []
  - name: packageManager
    description: "Package manager used"
    required: false
    type: string
    default: "npm"
tags: [setup, environment, configuration]
---

# {{technology}} Development Environment Setup

**Version**: {{version}}  
**OS Support**: {{operatingSystem}}  
**Last Updated**: {{formatDate _system.date "YYYY-MM-DD"}}  
**Estimated Time**: 30-45 minutes

## 📋 Prerequisites

{{#if prerequisites}}
Before installing {{technology}}, ensure you have:
{{#each prerequisites}}
- ✅ {{this}}
{{/each}}
{{else}}
- ✅ Administrative access to your machine
- ✅ Internet connection for downloading packages
- ✅ Basic command line knowledge
{{/if}}

## 🚀 Quick Start

```bash
# Quick installation command
{{#when (eq packageManager "npm")}}
npm install -g {{lowercase technology}}
{{/when}}
{{#when (eq packageManager "brew")}}
brew install {{lowercase technology}}
{{/when}}
{{#when (eq packageManager "apt")}}
sudo apt-get install {{lowercase technology}}
{{/when}}
{{#when (eq packageManager "choco")}}
choco install {{lowercase technology}}
{{/when}}

# Verify installation
{{lowercase technology}} --version
```

## 📦 Installation Steps

### Step 1: Install {{technology}}

{{#when (includes operatingSystem "Windows")}}
#### Windows Installation

1. **Using Chocolatey** (Recommended)
   ```powershell
   choco install {{lowercase technology}} -y
   ```

2. **Using Installer**
   - Download from [official website](https://{{lowercase technology}}.org/download)
   - Run the `.msi` installer
   - Follow installation wizard

3. **Using WSL2**
   ```bash
   # Inside WSL2
   curl -fsSL https://{{lowercase technology}}.org/install.sh | bash
   ```
{{/when}}

{{#when (includes operatingSystem "macOS")}}
#### macOS Installation

1. **Using Homebrew** (Recommended)
   ```bash
   brew install {{lowercase technology}}
   ```

2. **Using MacPorts**
   ```bash
   sudo port install {{lowercase technology}}
   ```

3. **Manual Installation**
   ```bash
   curl -o- https://{{lowercase technology}}.org/install.sh | bash
   ```
{{/when}}

{{#when (includes operatingSystem "Linux")}}
#### Linux Installation

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install {{lowercase technology}}
```

**Fedora/RHEL:**
```bash
sudo dnf install {{lowercase technology}}
```

**Arch Linux:**
```bash
sudo pacman -S {{lowercase technology}}
```

**Universal (Snap):**
```bash
sudo snap install {{lowercase technology}} --classic
```
{{/when}}

### Step 2: Configure Environment

1. **Set Environment Variables**
   ```bash
   # Add to ~/.bashrc, ~/.zshrc, or equivalent
   export {{uppercase technology}}_HOME=/path/to/{{lowercase technology}}
   export PATH=$PATH:${{uppercase technology}}_HOME/bin
   ```

2. **Reload Shell Configuration**
   ```bash
   source ~/.bashrc  # or ~/.zshrc
   ```

### Step 3: Verify Installation

```bash
# Check version
{{lowercase technology}} --version

# Check installation path
which {{lowercase technology}}

# Run diagnostic
{{lowercase technology}} doctor  # if available
```

## ⚙️ Configuration

### Basic Configuration

Create configuration file: `~/.{{lowercase technology}}rc` or `{{lowercase technology}}.config.json`

```json
{
  "version": "{{version}}",
  "settings": {
    "theme": "dark",
    "autoUpdate": true,
    "telemetry": false
  },
  "plugins": [],
  "aliases": {}
}
```

### Advanced Configuration

```yaml
# ~/.{{lowercase technology}}/config.yaml
global:
  logLevel: info
  cachePath: ~/.{{lowercase technology}}/cache

features:
  experimental: false
  beta: true

performance:
  maxWorkers: 4
  memoryLimit: 2048
```

## 🔧 IDE/Editor Integration

### VS Code
1. Install extension: `{{technology}} Language Support`
2. Configure settings:
   ```json
   {
     "{{lowercase technology}}.path": "/usr/local/bin/{{lowercase technology}}",
     "{{lowercase technology}}.linting": true
   }
   ```

### IntelliJ IDEA
1. Go to Settings → Plugins
2. Search for "{{technology}}"
3. Install and restart IDE

### Vim/Neovim
```vim
" Add to .vimrc or init.vim
Plug '{{lowercase technology}}-community/vim-{{lowercase technology}}'
```

## 🐛 Common Issues & Solutions

### Issue 1: Command Not Found
**Problem**: `{{lowercase technology}}: command not found`  
**Solution**: 
```bash
# Check if installed
which {{lowercase technology}}

# Add to PATH
echo 'export PATH=$PATH:/path/to/{{lowercase technology}}/bin' >> ~/.bashrc
source ~/.bashrc
```

### Issue 2: Permission Denied
**Problem**: Installation fails with permission errors  
**Solution**:
```bash
# Use sudo for system-wide installation
sudo npm install -g {{lowercase technology}}

# Or install locally
npm install --prefix ~/.local {{lowercase technology}}
```

### Issue 3: Version Conflicts
**Problem**: Multiple versions causing conflicts  
**Solution**:
```bash
# Use version manager
curl -o- https://{{lowercase technology}}-version-manager.sh | bash
{{lowercase technology}}vm install {{version}}
{{lowercase technology}}vm use {{version}}
```

## 📚 Post-Installation

### Essential Tools & Extensions

1. **Package Manager Setup**
   ```bash
   {{lowercase technology}} init
   {{lowercase technology}} config set registry https://registry.{{lowercase technology}}.org
   ```

2. **Recommended Global Packages**
   ```bash
   {{lowercase technology}} install -g essential-tool-1
   {{lowercase technology}} install -g essential-tool-2
   ```

3. **Development Dependencies**
   ```bash
   # For project development
   {{lowercase technology}} install --save-dev testing-framework
   {{lowercase technology}} install --save-dev linter
   ```

## 🧪 Testing Your Setup

### Hello World Example

Create `test.{{lowercase technology}}`:
```{{lowercase technology}}
// Basic test to verify setup
console.log("Hello from {{technology}} {{version}}!");
```

Run:
```bash
{{lowercase technology}} test.{{lowercase technology}}
```

### Complete Setup Test

```bash
# Run comprehensive test
git clone https://github.com/{{lowercase technology}}/setup-test
cd setup-test
{{lowercase technology}} install
{{lowercase technology}} test
```

## 📖 Next Steps

1. **Learn the Basics**
   - [[50-Learning-Resources/51-Tutorials/{{lowercase technology}}-basics|{{technology}} Basics Tutorial]]
   - [[60-Reference-Documentation/61-API-References/{{lowercase technology}}-api|API Reference]]

2. **Set Up a Project**
   - [[10-Active-Projects/new-{{lowercase technology}}-project|Create New Project]]
   - [[40-Code-Library/42-Templates/boilerplates/{{lowercase technology}}-starter|Starter Template]]

3. **Join the Community**
   - [Official Documentation](https://{{lowercase technology}}.org/docs)
   - [Community Forum](https://forum.{{lowercase technology}}.org)
   - [Discord Server](https://discord.gg/{{lowercase technology}})

## 🔗 Related Documentation

- [[30-Environment-Setup/32-Configurations/{{lowercase technology}}-advanced|Advanced Configuration]]
- [[90-Troubleshooting/91-Common-Issues/{{lowercase technology}}-issues|Troubleshooting Guide]]
- [[20-Development-Stack/24-Tools/{{lowercase technology}}-tools|{{technology}} Tooling]]

---
**Environment**: {{operatingSystem}}  
**Package Manager**: {{packageManager}}  
**Tags**: #env/setup #tech/{{lowercase technology}} #version/{{version}}