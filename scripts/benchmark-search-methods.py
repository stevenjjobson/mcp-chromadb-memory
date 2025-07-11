#!/usr/bin/env python3
"""
Benchmark script to compare traditional grep/glob searches vs optimized indexed searches
Tests against large codebases to demonstrate token usage and performance differences
"""

import os
import sys
import time
import json
import subprocess
import argparse
import statistics
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple
import tiktoken  # For accurate token counting

# Common search patterns to test
TEST_QUERIES = [
    # Class searches
    {"pattern": "class \\w+Controller", "description": "Find controller classes", "type": "class"},
    {"pattern": "class \\w+Service", "description": "Find service classes", "type": "class"},
    {"pattern": "class \\w+Repository", "description": "Find repository classes", "type": "class"},
    
    # Function searches
    {"pattern": "def authenticate", "description": "Find authentication functions", "type": "function"},
    {"pattern": "function render", "description": "Find render functions", "type": "function"},
    {"pattern": "async function fetch", "description": "Find async fetch functions", "type": "function"},
    
    # Generic searches
    {"pattern": "TODO|FIXME|HACK", "description": "Find code comments", "type": "comment"},
    {"pattern": "import.*from", "description": "Find imports", "type": "import"},
    {"pattern": "useState|useEffect", "description": "Find React hooks", "type": "hook"},
    
    # Complex patterns
    {"pattern": "try\\s*{[^}]+catch", "description": "Find try-catch blocks", "type": "error_handling"},
    {"pattern": "api|endpoint|route", "description": "Find API-related code", "type": "api"},
]

# Token pricing (GPT-4 as example)
TOKEN_PRICE_PER_1K = 0.03  # $0.03 per 1K input tokens

class SearchBenchmark:
    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)
        self.tokenizer = tiktoken.encoding_for_model("gpt-4")
        self.results = {
            "traditional": [],
            "optimized": [],
            "summary": {}
        }
        
    def count_tokens(self, text: str) -> int:
        """Count tokens using OpenAI's tiktoken"""
        return len(self.tokenizer.encode(text))
    
    def calculate_cost(self, tokens: int) -> float:
        """Calculate API cost based on token count"""
        return (tokens / 1000) * TOKEN_PRICE_PER_1K
    
    def run_traditional_grep(self, pattern: str, include: str = None) -> Tuple[str, float, int]:
        """Simulate traditional grep search that sends full file contents"""
        start_time = time.time()
        
        # Build grep command
        cmd = ["rg", "--json", pattern, str(self.repo_path)]
        if include:
            cmd.extend(["--glob", include])
        
        try:
            # Run ripgrep
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            output_lines = result.stdout.strip().split('\n')
            
            # Simulate what gets sent to LLM (full file contents for matches)
            total_content = []
            files_seen = set()
            
            for line in output_lines:
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if data.get("type") == "match":
                        file_path = data["data"]["path"]["text"]
                        
                        # Simulate reading entire file (what current tools do)
                        if file_path not in files_seen:
                            files_seen.add(file_path)
                            full_path = Path(file_path)
                            if full_path.exists():
                                try:
                                    with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                                        content = f.read()
                                        total_content.append(f"File: {file_path}\n{content}\n")
                                except:
                                    pass
                except json.JSONDecodeError:
                    continue
            
            # Calculate tokens
            full_text = "\n".join(total_content)
            tokens = self.count_tokens(full_text)
            elapsed = time.time() - start_time
            
            return full_text[:1000], elapsed, tokens  # Return sample for verification
            
        except subprocess.TimeoutExpired:
            return "Timeout", 30.0, 0
        except Exception as e:
            return f"Error: {e}", 0.0, 0
    
    def run_optimized_search(self, pattern: str, query_type: str) -> Tuple[str, float, int]:
        """Simulate optimized indexed search"""
        start_time = time.time()
        
        # Simulate indexed lookup (in reality would query PostgreSQL)
        # For demo, we'll use ripgrep but only extract relevant portions
        cmd = ["rg", "--json", "-A", "5", "-B", "5", pattern, str(self.repo_path)]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            output_lines = result.stdout.strip().split('\n')
            
            # Extract only symbol definitions (simulating indexed results)
            symbols = []
            for line in output_lines:
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if data.get("type") == "match":
                        match_data = data["data"]
                        # Extract just the symbol definition with context
                        symbols.append({
                            "file": match_data["path"]["text"],
                            "line": match_data["line_number"],
                            "text": match_data["lines"]["text"],
                            "type": query_type
                        })
                except:
                    continue
            
            # Format as concise symbol list (what optimized search returns)
            formatted_results = []
            for symbol in symbols[:50]:  # Limit results like a real search would
                formatted_results.append(
                    f"{symbol['type']} in {symbol['file']}:{symbol['line']}\n{symbol['text'].strip()}"
                )
            
            result_text = "\n\n".join(formatted_results)
            tokens = self.count_tokens(result_text)
            elapsed = time.time() - start_time
            
            return result_text[:1000], elapsed, tokens
            
        except subprocess.TimeoutExpired:
            return "Timeout", 10.0, 0
        except Exception as e:
            return f"Error: {e}", 0.0, 0
    
    def run_benchmark(self, queries: List[Dict] = None):
        """Run full benchmark suite"""
        if queries is None:
            queries = TEST_QUERIES
        
        print(f"\n🔍 Benchmarking searches on: {self.repo_path}")
        print(f"Repository size: {self.get_repo_stats()}")
        print("-" * 80)
        
        for query in queries:
            print(f"\n📊 Testing: {query['description']}")
            print(f"   Pattern: {query['pattern']}")
            
            # Traditional method
            trad_sample, trad_time, trad_tokens = self.run_traditional_grep(query['pattern'])
            trad_cost = self.calculate_cost(trad_tokens)
            
            # Optimized method
            opt_sample, opt_time, opt_tokens = self.run_optimized_search(
                query['pattern'], query['type']
            )
            opt_cost = self.calculate_cost(opt_tokens)
            
            # Calculate improvements
            token_reduction = ((trad_tokens - opt_tokens) / trad_tokens * 100) if trad_tokens > 0 else 0
            time_improvement = ((trad_time - opt_time) / trad_time * 100) if trad_time > 0 else 0
            cost_savings = trad_cost - opt_cost
            
            # Store results
            result = {
                "query": query['description'],
                "pattern": query['pattern'],
                "traditional": {
                    "tokens": trad_tokens,
                    "time": trad_time,
                    "cost": trad_cost
                },
                "optimized": {
                    "tokens": opt_tokens,
                    "time": opt_time,
                    "cost": opt_cost
                },
                "improvements": {
                    "token_reduction": token_reduction,
                    "time_improvement": time_improvement,
                    "cost_savings": cost_savings
                }
            }
            
            self.results["traditional"].append(result["traditional"])
            self.results["optimized"].append(result["optimized"])
            
            # Print results
            print(f"\n   Traditional (grep all files):")
            print(f"   - Tokens: {trad_tokens:,}")
            print(f"   - Time: {trad_time:.2f}s")
            print(f"   - Cost: ${trad_cost:.4f}")
            
            print(f"\n   Optimized (indexed search):")
            print(f"   - Tokens: {opt_tokens:,}")
            print(f"   - Time: {opt_time:.2f}s")
            print(f"   - Cost: ${opt_cost:.4f}")
            
            print(f"\n   ✨ Improvements:")
            print(f"   - Token reduction: {token_reduction:.1f}%")
            print(f"   - Speed improvement: {time_improvement:.1f}%")
            print(f"   - Cost savings: ${cost_savings:.4f} per search")
    
    def get_repo_stats(self) -> str:
        """Get repository statistics"""
        try:
            # Count files
            file_count = len(list(self.repo_path.rglob("*.*")))
            
            # Get directory size
            total_size = sum(f.stat().st_size for f in self.repo_path.rglob("*") if f.is_file())
            size_mb = total_size / 1024 / 1024
            
            return f"{file_count:,} files, {size_mb:.1f} MB"
        except:
            return "Unknown"
    
    def generate_summary(self):
        """Generate and print summary statistics"""
        if not self.results["traditional"]:
            print("\nNo results to summarize")
            return
        
        # Calculate averages
        avg_trad_tokens = statistics.mean(r["tokens"] for r in self.results["traditional"])
        avg_opt_tokens = statistics.mean(r["tokens"] for r in self.results["optimized"])
        avg_trad_time = statistics.mean(r["time"] for r in self.results["traditional"])
        avg_opt_time = statistics.mean(r["time"] for r in self.results["optimized"])
        avg_trad_cost = statistics.mean(r["cost"] for r in self.results["traditional"])
        avg_opt_cost = statistics.mean(r["cost"] for r in self.results["optimized"])
        
        # Calculate overall improvements
        overall_token_reduction = ((avg_trad_tokens - avg_opt_tokens) / avg_trad_tokens * 100)
        overall_time_improvement = ((avg_trad_time - avg_opt_time) / avg_trad_time * 100)
        overall_cost_reduction = ((avg_trad_cost - avg_opt_cost) / avg_trad_cost * 100)
        
        print("\n" + "=" * 80)
        print("📊 BENCHMARK SUMMARY")
        print("=" * 80)
        
        print(f"\n🔄 Average per search:")
        print(f"Traditional: {avg_trad_tokens:,.0f} tokens, {avg_trad_time:.2f}s, ${avg_trad_cost:.4f}")
        print(f"Optimized:   {avg_opt_tokens:,.0f} tokens, {avg_opt_time:.2f}s, ${avg_opt_cost:.4f}")
        
        print(f"\n🚀 Overall improvements:")
        print(f"Token reduction: {overall_token_reduction:.1f}%")
        print(f"Speed improvement: {overall_time_improvement:.1f}%")
        print(f"Cost reduction: {overall_cost_reduction:.1f}%")
        
        print(f"\n💰 Projected savings:")
        searches_per_day = 1000  # Conservative estimate for a small team
        daily_savings = (avg_trad_cost - avg_opt_cost) * searches_per_day
        monthly_savings = daily_savings * 30
        yearly_savings = daily_savings * 365
        
        print(f"Per 1,000 searches: ${(avg_trad_cost - avg_opt_cost) * 1000:.2f}")
        print(f"Per day (1K searches): ${daily_savings:.2f}")
        print(f"Per month: ${monthly_savings:,.2f}")
        print(f"Per year: ${yearly_savings:,.2f}")
        
        # Save detailed results
        self.save_results()
    
    def save_results(self):
        """Save detailed results to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"benchmark_results_{timestamp}.json"
        
        with open(output_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\n📁 Detailed results saved to: {output_file}")


def get_recommended_repos():
    """Return list of recommended repositories for benchmarking"""
    return [
        {
            "name": "React",
            "url": "https://github.com/facebook/react.git",
            "description": "Large JavaScript codebase with 1000+ files",
            "size": "~50MB"
        },
        {
            "name": "Django",
            "url": "https://github.com/django/django.git",
            "description": "Large Python framework with extensive codebase",
            "size": "~100MB"
        },
        {
            "name": "VS Code",
            "url": "https://github.com/microsoft/vscode.git",
            "description": "Massive TypeScript codebase, excellent for stress testing",
            "size": "~300MB"
        },
        {
            "name": "Kubernetes",
            "url": "https://github.com/kubernetes/kubernetes.git",
            "description": "Large Go codebase with complex structure",
            "size": "~500MB"
        },
        {
            "name": "TypeScript",
            "url": "https://github.com/microsoft/TypeScript.git",
            "description": "TypeScript compiler source, medium-large codebase",
            "size": "~150MB"
        }
    ]


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark traditional vs optimized code search methods"
    )
    parser.add_argument(
        "repo_path",
        nargs="?",
        help="Path to repository to benchmark"
    )
    parser.add_argument(
        "--recommend",
        action="store_true",
        help="Show recommended repositories for benchmarking"
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Run quick benchmark with fewer queries"
    )
    
    args = parser.parse_args()
    
    if args.recommend:
        print("\n🎯 Recommended repositories for benchmarking:\n")
        for repo in get_recommended_repos():
            print(f"📦 {repo['name']}")
            print(f"   URL: {repo['url']}")
            print(f"   Description: {repo['description']}")
            print(f"   Size: {repo['size']}")
            print()
        print("Clone with: git clone <url>")
        return
    
    if not args.repo_path:
        print("Error: Please provide a repository path or use --recommend to see options")
        parser.print_help()
        return
    
    repo_path = Path(args.repo_path)
    if not repo_path.exists():
        print(f"Error: Repository path does not exist: {repo_path}")
        return
    
    # Check for ripgrep
    try:
        subprocess.run(["rg", "--version"], capture_output=True, check=True)
    except:
        print("Error: ripgrep (rg) is required. Install it first:")
        print("  Ubuntu/Debian: sudo apt install ripgrep")
        print("  macOS: brew install ripgrep")
        print("  Windows: choco install ripgrep")
        return
    
    # Run benchmark
    benchmark = SearchBenchmark(repo_path)
    
    if args.quick:
        # Use subset of queries for quick test
        queries = TEST_QUERIES[:5]
    else:
        queries = TEST_QUERIES
    
    benchmark.run_benchmark(queries)
    benchmark.generate_summary()


if __name__ == "__main__":
    main()