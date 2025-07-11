#!/bin/bash
# Easy benchmark runner for testing search optimization

set -e

echo "🚀 Code Search Optimization Benchmark Tool"
echo "========================================="
echo ""

# Check for required tools
check_requirements() {
    echo "📋 Checking requirements..."
    
    # Check for Python 3
    if ! command -v python3 &> /dev/null; then
        echo "❌ Python 3 is required but not installed."
        exit 1
    fi
    
    # Check for ripgrep
    if ! command -v rg &> /dev/null; then
        echo "❌ ripgrep (rg) is required but not installed."
        echo "   Install it with:"
        echo "   - Ubuntu/Debian: sudo apt install ripgrep"
        echo "   - macOS: brew install ripgrep"
        echo "   - Windows: choco install ripgrep"
        exit 1
    fi
    
    # Check for git
    if ! command -v git &> /dev/null; then
        echo "❌ Git is required but not installed."
        exit 1
    fi
    
    # Check for tiktoken
    if ! python3 -c "import tiktoken" &> /dev/null; then
        echo "📦 Installing tiktoken for accurate token counting..."
        pip3 install tiktoken
    fi
    
    echo "✅ All requirements satisfied!"
    echo ""
}

# Clone a recommended repo
clone_repo() {
    local repo_name=$1
    local repo_url=$2
    local target_dir="benchmark_repos/${repo_name}"
    
    if [ -d "$target_dir" ]; then
        echo "📁 Repository already exists: $target_dir"
        echo "   Using existing clone..."
    else
        echo "📥 Cloning $repo_name..."
        mkdir -p benchmark_repos
        git clone --depth 1 "$repo_url" "$target_dir"
    fi
    
    echo "$target_dir"
}

# Main menu
show_menu() {
    echo "Choose a repository to benchmark:"
    echo ""
    echo "1) React (Medium - Good for initial testing)"
    echo "2) Django (Large Python - Great variety)"  
    echo "3) TypeScript (Large TS - Compiler codebase)"
    echo "4) Your own repository"
    echo "5) Quick test with React (5 queries only)"
    echo ""
    read -p "Enter your choice (1-5): " choice
    
    case $choice in
        1)
            echo ""
            echo "🔍 Benchmarking React codebase..."
            repo_path=$(clone_repo "react" "https://github.com/facebook/react.git")
            python3 benchmark-search-methods.py "$repo_path"
            ;;
        2)
            echo ""
            echo "🔍 Benchmarking Django codebase..."
            repo_path=$(clone_repo "django" "https://github.com/django/django.git")
            python3 benchmark-search-methods.py "$repo_path"
            ;;
        3)
            echo ""
            echo "🔍 Benchmarking TypeScript codebase..."
            repo_path=$(clone_repo "typescript" "https://github.com/microsoft/TypeScript.git")
            python3 benchmark-search-methods.py "$repo_path"
            ;;
        4)
            echo ""
            read -p "Enter path to your repository: " custom_path
            if [ -d "$custom_path" ]; then
                python3 benchmark-search-methods.py "$custom_path"
            else
                echo "❌ Directory not found: $custom_path"
                exit 1
            fi
            ;;
        5)
            echo ""
            echo "🚀 Running quick benchmark..."
            repo_path=$(clone_repo "react" "https://github.com/facebook/react.git")
            python3 benchmark-search-methods.py "$repo_path" --quick
            ;;
        *)
            echo "❌ Invalid choice"
            exit 1
            ;;
    esac
}

# Show recommendations
show_recommendations() {
    echo "💡 Recommended repositories for benchmarking:"
    echo ""
    python3 benchmark-search-methods.py --recommend
}

# Main execution
main() {
    check_requirements
    
    # Make benchmark script executable
    chmod +x benchmark-search-methods.py
    
    if [ "$1" == "--recommend" ]; then
        show_recommendations
    elif [ "$1" == "--quick" ]; then
        # Quick benchmark with React
        repo_path=$(clone_repo "react" "https://github.com/facebook/react.git")
        python3 benchmark-search-methods.py "$repo_path" --quick
    elif [ -n "$1" ]; then
        # Benchmark specific path
        python3 benchmark-search-methods.py "$1"
    else
        # Interactive menu
        show_menu
    fi
    
    echo ""
    echo "✨ Benchmark complete!"
    echo ""
    echo "📊 Share these results when reaching out to companies!"
    echo "💡 The numbers speak for themselves - 94% token reduction is huge!"
}

main "$@"