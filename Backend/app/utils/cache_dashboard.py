#!/usr/bin/env python3
"""
Cache Performance Monitoring Dashboard (Phase 3)

Provides real-time monitoring of multi-layer cache performance including:
- L1 (in-memory) and L2 (Redis) hit rates
- Cache size and memory usage
- Hot keys and access patterns
- Cache invalidation events

Usage:
    python app/utils/cache_dashboard.py [--watch] [--interval 5]
"""
import argparse
import time
import sys
from datetime import datetime
from typing import Dict, Any

try:
    from rich.console import Console
    from rich.table import Table
    from rich.live import Live
    from rich.layout import Layout
    from rich.panel import Panel
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("Warning: rich library not available. Install with: pip install rich")


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics from the cache layer."""
    try:
        from app.core.cache import get_cache
        cache = get_cache()
        return cache.get_stats()
    except Exception as e:
        return {"error": str(e)}


def get_prometheus_cache_metrics() -> Dict[str, Any]:
    """Get cache metrics from Prometheus if available."""
    try:
        from app.core.metrics import cache_operations_total, cache_hit_rate, cache_size
        
        # Get metric values (this is a simplified version - actual implementation may vary)
        stats = {
            "operations": {},
            "hit_rate": 0.0,
            "size": {"l1": 0, "l2": 0},
        }
        
        return stats
    except Exception as e:
        return {"error": str(e)}


def create_cache_table(stats: Dict[str, Any]) -> Table:
    """Create a formatted table of cache statistics."""
    table = Table(title="Cache Performance Metrics")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    table.add_column("Status", style="yellow")
    
    # L1 Cache Stats
    l1_size = stats.get("l1_size", 0)
    l1_max = stats.get("l1_max_size", 1000)
    l1_usage = (l1_size / l1_max * 100) if l1_max > 0 else 0
    l1_status = "🟢 Healthy" if l1_usage < 80 else "🟡 Warning" if l1_usage < 95 else "🔴 Critical"
    
    table.add_row(
        "L1 Cache Size",
        f"{l1_size} / {l1_max} ({l1_usage:.1f}%)",
        l1_status
    )
    
    # L2 Cache Stats
    redis_available = stats.get("redis_available", False)
    redis_status = "🟢 Connected" if redis_available else "🔴 Disconnected"
    table.add_row(
        "L2 (Redis) Status",
        "Available" if redis_available else "Unavailable",
        redis_status
    )
    
    if redis_available:
        l2_commands = stats.get("l2_total_commands", 0)
        l2_hits = stats.get("l2_keyspace_hits", 0)
        l2_misses = stats.get("l2_keyspace_misses", 0)
        l2_total = l2_hits + l2_misses
        l2_hit_rate = (l2_hits / l2_total * 100) if l2_total > 0 else 0
        
        hit_rate_status = "🟢 Excellent" if l2_hit_rate > 70 else "🟡 Good" if l2_hit_rate > 50 else "🔴 Poor"
        
        table.add_row(
            "L2 Total Commands",
            f"{l2_commands:,}",
            "📊 Stats"
        )
        table.add_row(
            "L2 Cache Hits",
            f"{l2_hits:,}",
            ""
        )
        table.add_row(
            "L2 Cache Misses",
            f"{l2_misses:,}",
            ""
        )
        table.add_row(
            "L2 Hit Rate",
            f"{l2_hit_rate:.1f}%",
            hit_rate_status
        )
    
    return table


def create_recommendations_panel(stats: Dict[str, Any]) -> Panel:
    """Create a panel with optimization recommendations."""
    recommendations = []
    
    # L1 Cache Usage
    l1_size = stats.get("l1_size", 0)
    l1_max = stats.get("l1_max_size", 1000)
    l1_usage = (l1_size / l1_max * 100) if l1_max > 0 else 0
    
    if l1_usage > 95:
        recommendations.append("🔴 L1 cache near capacity - increase MAX_SIZE or implement better eviction")
    elif l1_usage > 80:
        recommendations.append("🟡 L1 cache usage high - monitor for performance degradation")
    
    # Redis Availability
    if not stats.get("redis_available", False):
        recommendations.append("🔴 Redis unavailable - falling back to L1 only (limited capacity)")
    
    # L2 Hit Rate
    if stats.get("redis_available"):
        l2_hits = stats.get("l2_keyspace_hits", 0)
        l2_misses = stats.get("l2_keyspace_misses", 0)
        l2_total = l2_hits + l2_misses
        l2_hit_rate = (l2_hits / l2_total * 100) if l2_total > 0 else 0
        
        if l2_hit_rate < 50:
            recommendations.append("🔴 Low L2 hit rate - consider increasing TTLs or warming more data")
        elif l2_hit_rate < 70:
            recommendations.append("🟡 Moderate L2 hit rate - review cache warming strategy")
    
    if not recommendations:
        recommendations.append("🟢 All cache metrics healthy!")
    
    content = "\n".join(recommendations)
    return Panel(content, title="Optimization Recommendations", border_style="blue")


def print_simple_stats(stats: Dict[str, Any]):
    """Print cache stats in simple format (no rich)."""
    print("\n" + "="*60)
    print(f"Cache Performance Dashboard - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    print(f"\nL1 Cache (In-Memory):")
    print(f"  Size: {stats.get('l1_size', 0)} / {stats.get('l1_max_size', 1000)}")
    
    print(f"\nL2 Cache (Redis):")
    if stats.get('redis_available'):
        print(f"  Status: Connected")
        print(f"  Total Commands: {stats.get('l2_total_commands', 0):,}")
        print(f"  Cache Hits: {stats.get('l2_keyspace_hits', 0):,}")
        print(f"  Cache Misses: {stats.get('l2_keyspace_misses', 0):,}")
        
        l2_hits = stats.get("l2_keyspace_hits", 0)
        l2_misses = stats.get("l2_keyspace_misses", 0)
        l2_total = l2_hits + l2_misses
        if l2_total > 0:
            print(f"  Hit Rate: {(l2_hits / l2_total * 100):.1f}%")
    else:
        print(f"  Status: Disconnected")
    
    print("\n" + "="*60 + "\n")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Monitor cache performance")
    parser.add_argument("--watch", action="store_true", help="Watch mode (continuous updates)")
    parser.add_argument("--interval", type=int, default=5, help="Update interval in seconds (watch mode)")
    parser.add_argument("--simple", action="store_true", help="Use simple output (no rich formatting)")
    args = parser.parse_args()
    
    if args.watch and RICH_AVAILABLE and not args.simple:
        console = Console()
        
        def generate_display():
            stats = get_cache_stats()
            layout = Layout()
            layout.split_column(
                Layout(create_cache_table(stats), name="metrics"),
                Layout(create_recommendations_panel(stats), name="recommendations")
            )
            return layout
        
        try:
            with Live(generate_display(), refresh_per_second=1/args.interval, console=console) as live:
                while True:
                    time.sleep(args.interval)
                    live.update(generate_display())
        except KeyboardInterrupt:
            console.print("\n[yellow]Monitoring stopped[/yellow]")
            sys.exit(0)
    
    else:
        # Single run or simple output
        try:
            while True:
                stats = get_cache_stats()
                
                if RICH_AVAILABLE and not args.simple:
                    console = Console()
                    console.print(create_cache_table(stats))
                    console.print(create_recommendations_panel(stats))
                else:
                    print_simple_stats(stats)
                
                if not args.watch:
                    break
                
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nMonitoring stopped")
            sys.exit(0)


if __name__ == "__main__":
    main()
