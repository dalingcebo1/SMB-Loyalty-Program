#!/usr/bin/env python3
"""
Analyze slow queries from Azure PostgreSQL logs.

This script fetches and analyzes slow query logs from Azure PostgreSQL
to identify performance bottlenecks.

Usage:
    python scripts/analyze_slow_queries.py [--hours 24] [--top 20]
"""

import argparse
import subprocess
import json
import re
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from typing import List, Dict, Tuple


def fetch_logs(resource_group: str, server_name: str, hours: int = 24) -> List[str]:
    """Fetch PostgreSQL logs from Azure."""
    start_time = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
    
    print(f"Fetching logs from the last {hours} hours...")
    print(f"Start time: {start_time}")
    
    cmd = [
        "az", "postgres", "flexible-server", "logs", "list",
        "--resource-group", resource_group,
        "--server-name", server_name,
        "--query", "[?lastModifiedTime >= '{}'].name".format(start_time),
        "-o", "json"
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        log_files = json.loads(result.stdout)
        print(f"Found {len(log_files)} log files")
        return log_files
    except subprocess.CalledProcessError as e:
        print(f"Error fetching logs: {e.stderr}")
        return []


def download_log(resource_group: str, server_name: str, log_name: str) -> str:
    """Download a specific log file."""
    cmd = [
        "az", "postgres", "flexible-server", "logs", "download",
        "--resource-group", resource_group,
        "--server-name", server_name,
        "--name", log_name
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError:
        return ""


def parse_slow_queries(log_content: str) -> List[Dict]:
    """Parse slow queries from log content."""
    slow_queries = []
    
    # Pattern for "duration: XXX.XXX ms"
    duration_pattern = re.compile(r'duration:\s+([\d.]+)\s+ms.*?statement:\s+(.+?)(?=\n\d{4}-|\Z)', re.DOTALL)
    
    for match in duration_pattern.finditer(log_content):
        duration_ms = float(match.group(1))
        statement = match.group(2).strip()
        
        # Normalize query (remove specific values to group similar queries)
        normalized = normalize_query(statement)
        
        slow_queries.append({
            'duration_ms': duration_ms,
            'statement': statement,
            'normalized': normalized
        })
    
    return slow_queries


def normalize_query(query: str) -> str:
    """Normalize SQL query by replacing specific values with placeholders."""
    # Remove extra whitespace
    normalized = ' '.join(query.split())
    
    # Replace numbers with ?
    normalized = re.sub(r'\b\d+\b', '?', normalized)
    
    # Replace string literals with ?
    normalized = re.sub(r"'[^']*'", "'?'", normalized)
    
    # Replace UUIDs and similar patterns
    normalized = re.sub(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b', '?', normalized)
    
    # Truncate if too long
    if len(normalized) > 200:
        normalized = normalized[:200] + '...'
    
    return normalized


def analyze_queries(queries: List[Dict], top_n: int = 20) -> None:
    """Analyze and print slow query statistics."""
    if not queries:
        print("\n❌ No slow queries found in the logs!")
        print("This could mean:")
        print("  - No queries are taking > 1 second")
        print("  - Logs haven't been generated yet")
        print("  - Log settings need time to propagate")
        return
    
    print(f"\n{'='*80}")
    print(f"SLOW QUERY ANALYSIS")
    print(f"{'='*80}")
    print(f"\nTotal slow queries: {len(queries)}")
    
    # Group by normalized query
    query_groups = defaultdict(list)
    for q in queries:
        query_groups[q['normalized']].append(q['duration_ms'])
    
    # Calculate statistics for each query group
    query_stats = []
    for normalized, durations in query_groups.items():
        query_stats.append({
            'query': normalized,
            'count': len(durations),
            'total_time': sum(durations),
            'avg_time': sum(durations) / len(durations),
            'max_time': max(durations),
            'min_time': min(durations)
        })
    
    # Sort by total time (most impactful)
    query_stats.sort(key=lambda x: x['total_time'], reverse=True)
    
    print(f"\n{'='*80}")
    print(f"TOP {top_n} SLOW QUERIES (by total time)")
    print(f"{'='*80}\n")
    
    for i, stat in enumerate(query_stats[:top_n], 1):
        print(f"{i}. Query Pattern:")
        print(f"   {stat['query'][:150]}")
        if len(stat['query']) > 150:
            print(f"   ...")
        print(f"   Occurrences: {stat['count']}")
        print(f"   Total Time: {stat['total_time']:.2f} ms")
        print(f"   Avg Time: {stat['avg_time']:.2f} ms")
        print(f"   Max Time: {stat['max_time']:.2f} ms")
        print(f"   Min Time: {stat['min_time']:.2f} ms")
        print()
    
    # Identify queries without indexes (common patterns)
    print(f"\n{'='*80}")
    print("POTENTIAL MISSING INDEXES")
    print(f"{'='*80}\n")
    
    missing_indexes = []
    for stat in query_stats:
        query_lower = stat['query'].lower()
        if 'seq scan' in query_lower or 'where' in query_lower:
            if stat['avg_time'] > 500:  # > 500ms average
                missing_indexes.append(stat)
    
    if missing_indexes:
        for stat in missing_indexes[:10]:
            print(f"⚠️  {stat['query'][:100]}...")
            print(f"   Avg: {stat['avg_time']:.2f}ms, Count: {stat['count']}")
            print()
    else:
        print("✅ No obvious missing index patterns detected")
    
    # Tables most frequently queried
    print(f"\n{'='*80}")
    print("MOST QUERIED TABLES")
    print(f"{'='*80}\n")
    
    table_pattern = re.compile(r'FROM\s+(\w+)|JOIN\s+(\w+)|UPDATE\s+(\w+)|INSERT\s+INTO\s+(\w+)', re.IGNORECASE)
    table_counts = Counter()
    
    for q in queries:
        matches = table_pattern.findall(q['statement'])
        for match in matches:
            table = [t for t in match if t][0]  # Get non-empty group
            table_counts[table] += 1
    
    for table, count in table_counts.most_common(15):
        print(f"  {table:30} {count:5} queries")
    
    # Performance distribution
    print(f"\n{'='*80}")
    print("QUERY DURATION DISTRIBUTION")
    print(f"{'='*80}\n")
    
    buckets = {
        '1-2s': 0,
        '2-5s': 0,
        '5-10s': 0,
        '10-30s': 0,
        '30s+': 0
    }
    
    for q in queries:
        duration_s = q['duration_ms'] / 1000
        if duration_s < 2:
            buckets['1-2s'] += 1
        elif duration_s < 5:
            buckets['2-5s'] += 1
        elif duration_s < 10:
            buckets['5-10s'] += 1
        elif duration_s < 30:
            buckets['10-30s'] += 1
        else:
            buckets['30s+'] += 1
    
    for bucket, count in buckets.items():
        percentage = (count / len(queries)) * 100
        bar = '█' * int(percentage / 2)
        print(f"  {bucket:8} {count:5} queries ({percentage:5.1f}%) {bar}")


def main():
    parser = argparse.ArgumentParser(description='Analyze PostgreSQL slow queries')
    parser.add_argument('--hours', type=int, default=24, help='Hours of logs to analyze (default: 24)')
    parser.add_argument('--top', type=int, default=20, help='Number of top queries to show (default: 20)')
    parser.add_argument('--resource-group', default='SMB-Loyalty-Group', help='Azure resource group')
    parser.add_argument('--server-name', default='loyalty-pg-db', help='PostgreSQL server name')
    
    args = parser.parse_args()
    
    print("PostgreSQL Slow Query Analyzer")
    print("=" * 80)
    print(f"Resource Group: {args.resource_group}")
    print(f"Server: {args.server_name}")
    print(f"Time Range: Last {args.hours} hours")
    print("=" * 80)
    
    # Fetch log files
    log_files = fetch_logs(args.resource_group, args.server_name, args.hours)
    
    if not log_files:
        print("\n⚠️  No log files found. This could mean:")
        print("  1. No queries exceeded 1 second in the specified time range")
        print("  2. Log settings were just enabled (wait a few minutes)")
        print("  3. The server hasn't had much activity")
        return
    
    # Download and parse logs
    all_queries = []
    for i, log_file in enumerate(log_files[:10], 1):  # Limit to 10 most recent files
        print(f"Processing log file {i}/{min(len(log_files), 10)}: {log_file}")
        content = download_log(args.resource_group, args.server_name, log_file)
        queries = parse_slow_queries(content)
        all_queries.extend(queries)
        print(f"  Found {len(queries)} slow queries")
    
    # Analyze
    analyze_queries(all_queries, args.top)
    
    print(f"\n{'='*80}")
    print("RECOMMENDATIONS")
    print(f"{'='*80}\n")
    print("1. Focus on queries with high total_time (frequency × duration)")
    print("2. Add indexes for frequently queried columns")
    print("3. Review queries taking > 5 seconds for optimization opportunities")
    print("4. Use EXPLAIN ANALYZE on slow queries to identify bottlenecks")
    print("5. Monitor Prometheus metrics at /metrics endpoint")
    print("\nFor detailed query analysis, connect to the database and run:")
    print("  SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;")


if __name__ == '__main__':
    main()
