#!/usr/bin/env python3
"""
Real-time Performance Dashboard

Displays real-time performance metrics from the application's Prometheus endpoint.

Usage:
    python scripts/performance_dashboard.py [--url http://localhost:8000]
"""

import argparse
import requests
import time
import sys
from collections import defaultdict
from datetime import datetime


def clear_screen():
    """Clear the terminal screen."""
    print("\033[2J\033[H", end="")


def fetch_metrics(url: str) -> dict:
    """Fetch metrics from Prometheus endpoint."""
    try:
        response = requests.get(f"{url}/metrics", timeout=5)
        response.raise_for_status()
        return parse_prometheus_metrics(response.text)
    except Exception as e:
        return {"error": str(e)}


def parse_prometheus_metrics(text: str) -> dict:
    """Parse Prometheus text format metrics."""
    metrics = defaultdict(lambda: defaultdict(float))
    
    for line in text.split('\n'):
        line = line.strip()
        
        # Skip comments and empty lines
        if not line or line.startswith('#'):
            continue
        
        # Parse metric line: metric_name{labels} value
        try:
            if '{' in line:
                # Has labels
                name_part, rest = line.split('{', 1)
                labels_part, value = rest.rsplit('}', 1)
                value = float(value.strip())
                
                # Parse labels
                labels = {}
                for label in labels_part.split(','):
                    if '=' in label:
                        key, val = label.split('=', 1)
                        labels[key.strip()] = val.strip('"')
                
                metrics[name_part][str(labels)] = value
            else:
                # No labels
                name, value = line.rsplit(None, 1)
                metrics[name][''] = float(value)
        except (ValueError, IndexError):
            continue
    
    return dict(metrics)


def format_duration(seconds: float) -> str:
    """Format duration in human-readable format."""
    if seconds < 0.001:
        return f"{seconds*1000000:.0f}µs"
    elif seconds < 1:
        return f"{seconds*1000:.1f}ms"
    else:
        return f"{seconds:.2f}s"


def display_dashboard(metrics: dict):
    """Display the performance dashboard."""
    clear_screen()
    
    if "error" in metrics:
        print(f"❌ Error fetching metrics: {metrics['error']}")
        print("\nMake sure the application is running and accessible.")
        return
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    print("=" * 100)
    print(f"  PERFORMANCE DASHBOARD - {now}".center(100))
    print("=" * 100)
    
    # HTTP Request Summary
    print("\n📊 HTTP REQUESTS")
    print("-" * 100)
    
    http_total = sum(metrics.get('http_requests_total', {}).values())
    print(f"  Total Requests: {http_total:.0f}")
    
    # Request rate (approximation - would need history for true rate)
    if http_total > 0:
        print(f"  Request Distribution:")
        status_codes = defaultdict(int)
        for labels_str, count in metrics.get('http_requests_total', {}).items():
            if 'status="' in labels_str:
                # Extract status code
                import re
                match = re.search(r'status="(\d+)"', labels_str)
                if match:
                    status = match.group(1)
                    status_codes[status] += int(count)
        
        for status in sorted(status_codes.keys()):
            count = status_codes[status]
            pct = (count / http_total) * 100
            status_emoji = "✅" if status.startswith('2') else "⚠️" if status.startswith('4') else "❌"
            print(f"    {status_emoji} {status}xx: {count:.0f} ({pct:.1f}%)")
    
    # Database Queries
    print("\n🗄️  DATABASE QUERIES")
    print("-" * 100)
    
    db_total = sum(metrics.get('database_queries_total', {}).values())
    slow_total = sum(metrics.get('database_slow_queries_total', {}).values())
    
    print(f"  Total Queries: {db_total:.0f}")
    print(f"  Slow Queries (>1s): {slow_total:.0f}", end="")
    
    if db_total > 0:
        slow_pct = (slow_total / db_total) * 100
        if slow_pct > 10:
            print(f" ⚠️  {slow_pct:.1f}% are slow!")
        elif slow_pct > 0:
            print(f" ({slow_pct:.1f}%)")
        else:
            print(" ✅")
    else:
        print()
    
    # Slow queries by endpoint
    if slow_total > 0:
        print("\n  Slow Queries by Endpoint:")
        slow_queries = metrics.get('database_slow_queries_total', {})
        endpoint_totals = defaultdict(int)
        
        for labels_str, count in slow_queries.items():
            if 'endpoint="' in labels_str:
                import re
                match = re.search(r'endpoint="([^"]+)"', labels_str)
                if match:
                    endpoint = match.group(1)
                    endpoint_totals[endpoint] += int(count)
        
        for endpoint in sorted(endpoint_totals.items(), key=lambda x: x[1], reverse=True)[:5]:
            print(f"    {endpoint[0][:60]:60} {endpoint[1]:5.0f}")
    
    # Query duration percentiles (from histogram)
    print("\n  Query Duration Distribution:")
    duration_buckets = {}
    for labels_str, value in metrics.get('database_query_duration_seconds_bucket', {}).items():
        if 'le="' in labels_str:
            import re
            match = re.search(r'le="([^"]+)"', labels_str)
            if match:
                le = match.group(1)
                if le != '+Inf':
                    duration_buckets[float(le)] = int(value)
    
    if duration_buckets:
        sorted_buckets = sorted(duration_buckets.items())
        prev_count = 0
        for le, count in sorted_buckets[:7]:
            delta = count - prev_count
            if delta > 0:
                print(f"    ≤ {format_duration(le):8} : {delta:6.0f} queries")
            prev_count = count
    
    # Cache Performance
    print("\n💾 CACHE PERFORMANCE")
    print("-" * 100)
    
    cache_ops = metrics.get('cache_operations_total', {})
    if cache_ops:
        hits = sum(v for k, v in cache_ops.items() if 'hit' in k.lower())
        misses = sum(v for k, v in cache_ops.items() if 'miss' in k.lower())
        total_ops = hits + misses
        
        if total_ops > 0:
            hit_rate = (hits / total_ops) * 100
            print(f"  Hit Rate: {hit_rate:.1f}% ({hits:.0f} hits / {total_ops:.0f} total)")
            
            if hit_rate > 80:
                print("  Status: ✅ Excellent cache performance")
            elif hit_rate > 50:
                print("  Status: ⚠️  Cache could be improved")
            else:
                print("  Status: ❌ Poor cache hit rate")
    else:
        print("  No cache metrics available")
    
    # Celery Tasks
    print("\n⚙️  BACKGROUND TASKS (Celery)")
    print("-" * 100)
    
    celery_total = sum(metrics.get('celery_tasks_total', {}).values())
    if celery_total > 0:
        print(f"  Total Tasks: {celery_total:.0f}")
        
        success = sum(v for k, v in metrics.get('celery_tasks_total', {}).items() if 'success' in k.lower())
        failure = sum(v for k, v in metrics.get('celery_tasks_total', {}).items() if 'failure' in k.lower())
        
        if celery_total > 0:
            success_rate = (success / celery_total) * 100
            print(f"  Success Rate: {success_rate:.1f}%")
            print(f"  Failures: {failure:.0f}")
    else:
        print("  No task execution data")
    
    # Connection Pool
    print("\n🔌 DATABASE CONNECTIONS")
    print("-" * 100)
    
    connections = metrics.get('database_connections', {})
    if connections:
        active = sum(v for k, v in connections.items() if 'active' in k.lower())
        idle = sum(v for k, v in connections.items() if 'idle' in k.lower())
        
        print(f"  Active: {active:.0f}")
        print(f"  Idle: {idle:.0f}")
        print(f"  Total: {active + idle:.0f}")
    else:
        print("  No connection pool metrics available")
    
    print("\n" + "=" * 100)
    print("  Press Ctrl+C to exit | Refreshing every 5 seconds".center(100))
    print("=" * 100)


def main():
    parser = argparse.ArgumentParser(description='Performance Dashboard')
    parser.add_argument('--url', default='http://localhost:8000', help='Application base URL')
    parser.add_argument('--interval', type=int, default=5, help='Refresh interval in seconds')
    
    args = parser.parse_args()
    
    print("Starting Performance Dashboard...")
    print(f"Monitoring: {args.url}")
    print(f"Refresh interval: {args.interval}s")
    print("\nFetching metrics...\n")
    
    try:
        while True:
            metrics = fetch_metrics(args.url)
            display_dashboard(metrics)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n\nDashboard stopped.")
        sys.exit(0)


if __name__ == '__main__':
    main()
