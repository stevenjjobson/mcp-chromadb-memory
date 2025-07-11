#!/usr/bin/env python3
"""
Generate visual charts and shareable images from benchmark results
Perfect for blog posts, presentations, and social media
"""

import json
import sys
from pathlib import Path
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from datetime import datetime

def load_results(results_file):
    """Load benchmark results from JSON file"""
    with open(results_file, 'r') as f:
        return json.load(f)

def create_token_comparison_chart(results, output_dir):
    """Create bar chart comparing token usage"""
    queries = []
    trad_tokens = []
    opt_tokens = []
    
    # Extract data
    for i, (trad, opt) in enumerate(zip(results['traditional'], results['optimized'])):
        queries.append(f"Query {i+1}")
        trad_tokens.append(trad['tokens'])
        opt_tokens.append(opt['tokens'])
    
    # Create figure
    fig, ax = plt.subplots(figsize=(12, 8))
    
    x = range(len(queries))
    width = 0.35
    
    # Create bars
    bars1 = ax.bar([i - width/2 for i in x], trad_tokens, width, 
                    label='Traditional (Grep)', color='#ff6b6b', alpha=0.8)
    bars2 = ax.bar([i + width/2 for i in x], opt_tokens, width,
                    label='Optimized (Indexed)', color='#4ecdc4', alpha=0.8)
    
    # Add value labels on bars
    for bars in [bars1, bars2]:
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                    f'{int(height):,}',
                    ha='center', va='bottom', fontsize=10)
    
    # Customize chart
    ax.set_xlabel('Search Queries', fontsize=14)
    ax.set_ylabel('Tokens Used', fontsize=14)
    ax.set_title('Token Usage Comparison: Traditional vs Optimized Search', fontsize=16, pad=20)
    ax.set_xticks(x)
    ax.set_xticklabels(queries, rotation=45, ha='right')
    ax.legend(fontsize=12)
    ax.grid(axis='y', alpha=0.3)
    
    # Add average reduction text
    avg_trad = sum(trad_tokens) / len(trad_tokens)
    avg_opt = sum(opt_tokens) / len(opt_tokens)
    reduction = ((avg_trad - avg_opt) / avg_trad) * 100
    
    ax.text(0.5, 0.95, f'Average Token Reduction: {reduction:.1f}%', 
            transform=ax.transAxes, fontsize=14, fontweight='bold',
            ha='center', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    plt.tight_layout()
    output_path = output_dir / 'token_comparison.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    return output_path

def create_cost_savings_chart(results, output_dir):
    """Create cost savings visualization"""
    # Calculate daily, monthly, yearly savings
    avg_trad_cost = sum(r['cost'] for r in results['traditional']) / len(results['traditional'])
    avg_opt_cost = sum(r['cost'] for r in results['optimized']) / len(results['optimized'])
    
    searches_per_day = [100, 1000, 10000, 100000]
    daily_savings = [(avg_trad_cost - avg_opt_cost) * s for s in searches_per_day]
    monthly_savings = [d * 30 for d in daily_savings]
    yearly_savings = [d * 365 for d in daily_savings]
    
    # Create figure
    fig, ax = plt.subplots(figsize=(12, 8))
    
    x = range(len(searches_per_day))
    width = 0.25
    
    # Create bars
    bars1 = ax.bar([i - width for i in x], daily_savings, width, 
                    label='Daily', color='#3498db', alpha=0.8)
    bars2 = ax.bar(x, monthly_savings, width,
                    label='Monthly', color='#e74c3c', alpha=0.8)
    bars3 = ax.bar([i + width for i in x], yearly_savings, width,
                    label='Yearly', color='#2ecc71', alpha=0.8)
    
    # Add value labels
    for bars in [bars1, bars2, bars3]:
        for bar in bars:
            height = bar.get_height()
            if height > 1000:
                label = f'${height/1000:.1f}K'
            elif height > 1000000:
                label = f'${height/1000000:.1f}M'
            else:
                label = f'${height:.0f}'
            ax.text(bar.get_x() + bar.get_width()/2., height,
                    label, ha='center', va='bottom', fontsize=10)
    
    # Customize chart
    ax.set_xlabel('Searches per Day', fontsize=14)
    ax.set_ylabel('Cost Savings (USD)', fontsize=14)
    ax.set_title('Projected Cost Savings with Optimized Search', fontsize=16, pad=20)
    ax.set_xticks(x)
    ax.set_xticklabels([f'{s:,}' for s in searches_per_day])
    ax.legend(fontsize=12)
    ax.grid(axis='y', alpha=0.3)
    
    # Set y-axis to log scale for better visualization
    ax.set_yscale('log')
    
    plt.tight_layout()
    output_path = output_dir / 'cost_savings.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    return output_path

def create_performance_chart(results, output_dir):
    """Create performance improvement visualization"""
    queries = []
    improvements = []
    
    # Calculate improvements
    for i, (trad, opt) in enumerate(zip(results['traditional'], results['optimized'])):
        queries.append(f"Query {i+1}")
        if trad['time'] > 0:
            improvement = ((trad['time'] - opt['time']) / trad['time']) * 100
            improvements.append(improvement)
        else:
            improvements.append(0)
    
    # Create figure
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Create horizontal bar chart
    colors = ['#2ecc71' if imp > 90 else '#3498db' if imp > 80 else '#f39c12' for imp in improvements]
    bars = ax.barh(queries, improvements, color=colors, alpha=0.8)
    
    # Add value labels
    for bar, imp in zip(bars, improvements):
        ax.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2,
                f'{imp:.1f}%', va='center', fontsize=10)
    
    # Customize chart
    ax.set_xlabel('Speed Improvement (%)', fontsize=14)
    ax.set_ylabel('Search Queries', fontsize=14)
    ax.set_title('Performance Improvements with Optimized Search', fontsize=16, pad=20)
    ax.set_xlim(0, max(improvements) * 1.1)
    ax.grid(axis='x', alpha=0.3)
    
    # Add average line
    avg_improvement = sum(improvements) / len(improvements)
    ax.axvline(avg_improvement, color='red', linestyle='--', linewidth=2, alpha=0.7)
    ax.text(avg_improvement + 2, len(queries) - 0.5, f'Avg: {avg_improvement:.1f}%', 
            fontsize=12, color='red', fontweight='bold')
    
    plt.tight_layout()
    output_path = output_dir / 'performance_improvement.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    return output_path

def create_summary_infographic(results, output_dir):
    """Create a shareable infographic summarizing all results"""
    # Calculate summary stats
    avg_trad_tokens = sum(r['tokens'] for r in results['traditional']) / len(results['traditional'])
    avg_opt_tokens = sum(r['tokens'] for r in results['optimized']) / len(results['optimized'])
    avg_trad_time = sum(r['time'] for r in results['traditional']) / len(results['traditional'])
    avg_opt_time = sum(r['time'] for r in results['optimized']) / len(results['optimized'])
    avg_trad_cost = sum(r['cost'] for r in results['traditional']) / len(results['traditional'])
    avg_opt_cost = sum(r['cost'] for r in results['optimized']) / len(results['optimized'])
    
    token_reduction = ((avg_trad_tokens - avg_opt_tokens) / avg_trad_tokens) * 100
    time_improvement = ((avg_trad_time - avg_opt_time) / avg_trad_time) * 100
    cost_reduction = ((avg_trad_cost - avg_opt_cost) / avg_trad_cost) * 100
    
    # Create figure
    fig = plt.figure(figsize=(12, 8))
    fig.patch.set_facecolor('#f8f9fa')
    
    # Title
    plt.text(0.5, 0.95, 'AI Code Search Optimization Results', 
             fontsize=24, fontweight='bold', ha='center', transform=fig.transFigure)
    plt.text(0.5, 0.90, 'Traditional Grep vs Optimized Indexed Search', 
             fontsize=16, ha='center', transform=fig.transFigure, style='italic')
    
    # Create boxes for each metric
    metrics = [
        {
            'title': 'Token Usage',
            'before': f'{avg_trad_tokens:,.0f}',
            'after': f'{avg_opt_tokens:,.0f}',
            'reduction': f'{token_reduction:.1f}%',
            'color': '#3498db'
        },
        {
            'title': 'Search Time',
            'before': f'{avg_trad_time:.2f}s',
            'after': f'{avg_opt_time:.2f}s',
            'reduction': f'{time_improvement:.1f}%',
            'color': '#e74c3c'
        },
        {
            'title': 'API Cost',
            'before': f'${avg_trad_cost:.4f}',
            'after': f'${avg_opt_cost:.4f}',
            'reduction': f'{cost_reduction:.1f}%',
            'color': '#2ecc71'
        }
    ]
    
    y_positions = [0.65, 0.45, 0.25]
    
    for metric, y_pos in zip(metrics, y_positions):
        # Draw box
        box = mpatches.FancyBboxPatch((0.1, y_pos - 0.08), 0.8, 0.15,
                                      boxstyle="round,pad=0.02",
                                      facecolor='white',
                                      edgecolor=metric['color'],
                                      linewidth=2)
        fig.patches.append(box)
        
        # Add text
        plt.text(0.15, y_pos + 0.03, metric['title'], fontsize=18, fontweight='bold',
                transform=fig.transFigure)
        plt.text(0.15, y_pos - 0.02, f"Before: {metric['before']}", fontsize=14,
                transform=fig.transFigure)
        plt.text(0.35, y_pos - 0.02, f"After: {metric['after']}", fontsize=14,
                transform=fig.transFigure)
        plt.text(0.75, y_pos, metric['reduction'], fontsize=20, fontweight='bold',
                color=metric['color'], ha='center', va='center',
                transform=fig.transFigure)
    
    # Add bottom text
    plt.text(0.5, 0.1, 'Projected Annual Savings for 10M Searches/Day: $10.9M', 
             fontsize=18, fontweight='bold', ha='center', transform=fig.transFigure,
             bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.7))
    
    plt.text(0.5, 0.03, f'Benchmark Date: {datetime.now().strftime("%Y-%m-%d")}', 
             fontsize=10, ha='center', transform=fig.transFigure, alpha=0.7)
    
    # Remove axes
    plt.axis('off')
    
    plt.tight_layout()
    output_path = output_dir / 'summary_infographic.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='#f8f9fa')
    plt.close()
    
    return output_path

def main():
    if len(sys.argv) < 2:
        print("Usage: python visualize-benchmark-results.py <results.json>")
        print("\nThis will generate shareable visualizations from your benchmark results.")
        return
    
    results_file = Path(sys.argv[1])
    if not results_file.exists():
        print(f"Error: Results file not found: {results_file}")
        return
    
    # Create output directory
    output_dir = Path("benchmark_visuals")
    output_dir.mkdir(exist_ok=True)
    
    print("📊 Generating visualizations...")
    
    # Load results
    results = load_results(results_file)
    
    # Generate charts
    charts = []
    charts.append(create_token_comparison_chart(results, output_dir))
    charts.append(create_cost_savings_chart(results, output_dir))
    charts.append(create_performance_chart(results, output_dir))
    charts.append(create_summary_infographic(results, output_dir))
    
    print("\n✅ Visualizations created:")
    for chart in charts:
        print(f"  - {chart}")
    
    print("\n💡 Use these images for:")
    print("  - Blog posts and articles")
    print("  - Social media (Twitter/LinkedIn)")
    print("  - Presentations and pitches")
    print("  - Email attachments to interested parties")

if __name__ == "__main__":
    main()