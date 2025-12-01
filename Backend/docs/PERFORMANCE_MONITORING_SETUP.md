# Performance Monitoring Setup - Complete

**Date:** December 1, 2025  
**Status:** ✅ Monitoring Active  
**Tools:** Azure PostgreSQL Logs + Prometheus + Real-time Dashboard

---

## Overview

Comprehensive performance monitoring has been configured and deployed to track database query performance, identify bottlenecks, and enable proactive optimization.

---

## 1. ✅ Azure PostgreSQL Slow Query Logging

### Configuration Applied

All settings have been configured on **Azure PostgreSQL Flexible Server** (`loyalty-pg-db` in resource group `SMB-Loyalty-Group`):

| Parameter | Value | Description |
|-----------|-------|-------------|
| `log_min_duration_statement` | `1000` ms | Log queries taking > 1 second |
| `log_duration` | `on` | Log duration of all statements |
| `log_lock_waits` | `on` | Log lock contention issues |
| `log_statement` | `mod` | Log INSERT/UPDATE/DELETE statements |

### Verify Settings

```bash
az postgres flexible-server parameter list \
  --resource-group SMB-Loyalty-Group \
  --server-name loyalty-pg-db \
  --query "[?name=='log_min_duration_statement' || name=='log_duration'].{Name:name, Value:value}" \
  -o table
```

**Expected Output:**
```
Name                        Value
--------------------------  -------
log_duration                on
log_min_duration_statement  1000
```

---

## 2. ✅ Real-time Query Monitoring (Application-level)

### Implementation

**File:** `Backend/app/core/query_monitor.py`

SQLAlchemy event listeners track every database query:

- **Query duration tracking** - Measures time for every SQL statement
- **Slow query detection** - Automatically flags queries > 1 second
- **Endpoint attribution** - Links slow queries to specific API endpoints
- **Automatic logging** - Logs slow queries with context

### Integration

Query monitoring is automatically enabled on application startup (when `ENABLE_METRICS=true`):

```python
# In Backend/main.py startup event
from app.core.query_monitor import setup_query_monitoring
setup_query_monitoring()
```

### Metrics Emitted

Available at `http://localhost:8000/metrics`:

```
# Query duration histogram
database_query_duration_seconds{operation="select",table="orders"} 0.023

# Slow query counter  
database_slow_queries_total{operation="select",table="orders",endpoint="GET /api/orders"} 5
```

---

## 3. ✅ Monitoring Tools

### Tool 1: Azure Log Analyzer

**File:** `Backend/scripts/analyze_slow_queries.py`

Fetches and analyzes PostgreSQL logs from Azure, providing:
- Top slow queries by total time
- Query duration distribution
- Most queried tables
- Potential missing indexes
- Actionable recommendations

**Usage:**
```bash
cd Backend

# Analyze last 24 hours
python scripts/analyze_slow_queries.py --hours 24 --top 20

# Analyze last week, show top 50
python scripts/analyze_slow_queries.py --hours 168 --top 50

# Help
python scripts/analyze_slow_queries.py --help
```

**Example Output:**
```
================================================================================
SLOW QUERY ANALYSIS
================================================================================

Total slow queries: 247

================================================================================
TOP 20 SLOW QUERIES (by total time)
================================================================================

1. Query Pattern:
   SELECT * FROM orders WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC
   Occurrences: 45
   Total Time: 87234.50 ms
   Avg Time: 1938.54 ms
   Max Time: 3421.20 ms

2. Query Pattern:
   SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL
   Occurrences: 123
   Total Time: 45678.90 ms
   Avg Time: 371.29 ms
```

### Tool 2: Real-time Performance Dashboard

**File:** `Backend/scripts/performance_dashboard.py`

Live monitoring dashboard that displays:
- HTTP request metrics (total, status codes, rate)
- Database query stats (total, slow queries, duration distribution)
- Cache performance (hit rate, operations)
- Background tasks (Celery success/failure)
- Connection pool status

**Usage:**
```bash
# Start the application first
cd Backend
uvicorn main:app --reload --port 8000

# In another terminal, start the dashboard
python scripts/performance_dashboard.py --url http://localhost:8000 --interval 5

# For production
python scripts/performance_dashboard.py --url https://your-app.azurewebsites.net
```

**Screenshot (Example):**
```
====================================================================================================
                              PERFORMANCE DASHBOARD - 2025-12-01 20:15:30
====================================================================================================

📊 HTTP REQUESTS
----------------------------------------------------------------------------------------------------
  Total Requests: 1,247
  Request Distribution:
    ✅ 2xx: 1,189 (95.3%)
    ⚠️  4xx: 52 (4.2%)
    ❌ 5xx: 6 (0.5%)

🗄️  DATABASE QUERIES
----------------------------------------------------------------------------------------------------
  Total Queries: 3,842
  Slow Queries (>1s): 12 ⚠️  0.3%

  Slow Queries by Endpoint:
    GET /api/admin/analytics                                     5
    POST /api/orders/create                                      4
    GET /api/loyalty/leaderboard                                 3

  Query Duration Distribution:
    ≤ 5.0ms   :   3,124 queries
    ≤ 10ms    :     598 queries
    ≤ 50ms    :      98 queries
    ≤ 100ms   :      14 queries
    ≤ 1.0s    :       6 queries
    ≤ 5.0s    :      12 queries

💾 CACHE PERFORMANCE
----------------------------------------------------------------------------------------------------
  Hit Rate: 87.4% (1,089 hits / 1,245 total)
  Status: ✅ Excellent cache performance
```

---

## 4. Prometheus Metrics Integration

### New Metrics Added

**In:** `Backend/app/core/metrics.py`

```python
# Slow query counter
database_slow_queries_total = Counter(
    'database_slow_queries_total',
    'Total slow database queries (duration > 1s)',
    ['operation', 'table', 'endpoint']
)
```

### Query Prometheus Directly

```bash
# Get slow query count by endpoint
curl http://localhost:8000/metrics | grep database_slow_queries_total

# Example output:
# database_slow_queries_total{endpoint="GET /api/orders",operation="select",table="orders"} 3.0
# database_slow_queries_total{endpoint="GET /api/analytics",operation="select",table="orders"} 7.0
```

### Grafana Dashboard (Optional)

If you have Grafana configured, use these PromQL queries:

```promql
# Slow query rate per minute
rate(database_slow_queries_total[1m]) * 60

# Top 5 endpoints with slow queries
topk(5, sum by (endpoint) (database_slow_queries_total))

# Query duration 95th percentile
histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m]))

# Slow query percentage
(sum(rate(database_slow_queries_total[5m])) / sum(rate(database_queries_total[5m]))) * 100
```

---

## 5. Operational Procedures

### Daily Monitoring Workflow

**1. Morning Check (5 minutes):**
```bash
# Check slow query summary
python scripts/analyze_slow_queries.py --hours 24 --top 10 | head -50
```

**2. Real-time Monitoring (continuous):**
```bash
# Keep dashboard open during peak hours
python scripts/performance_dashboard.py
```

**3. Weekly Review (30 minutes):**
```bash
# Comprehensive analysis
python scripts/analyze_slow_queries.py --hours 168 --top 50 > weekly_report.txt

# Review for patterns:
# - Are specific endpoints consistently slow?
# - Are certain tables frequently queried?
# - Are there queries that should be cached?
```

### Alerting Thresholds

Set up alerts for these conditions:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Slow query rate | > 10/minute | Investigate immediately |
| Slow query % | > 5% of total | Review indexes |
| Cache hit rate | < 70% | Review cache strategy |
| Query duration p95 | > 500ms | Optimize hot paths |

---

## 6. Troubleshooting Common Issues

### Issue: No slow queries logged

**Symptoms:** `analyze_slow_queries.py` returns empty results

**Causes:**
1. Log settings just enabled (wait 5-10 minutes)
2. No queries actually exceeding 1 second
3. Low application traffic

**Resolution:**
```bash
# Verify settings are active
az postgres flexible-server parameter show \
  --resource-group SMB-Loyalty-Group \
  --server-name loyalty-pg-db \
  --name log_min_duration_statement

# Lower threshold temporarily for testing
az postgres flexible-server parameter set \
  --resource-group SMB-Loyalty-Group \
  --server-name loyalty-pg-db \
  --name log_min_duration_statement \
  --value 100  # 100ms instead of 1000ms
```

### Issue: Dashboard shows "Error fetching metrics"

**Symptoms:** Performance dashboard displays connection error

**Causes:**
1. Application not running
2. Wrong URL
3. /metrics endpoint disabled

**Resolution:**
```bash
# Verify app is running
curl http://localhost:8000/health

# Check metrics endpoint
curl http://localhost:8000/metrics | head -20

# Verify ENABLE_METRICS=true in .env
grep ENABLE_METRICS Backend/.env
```

### Issue: Slow queries detected but don't appear slow

**Symptoms:** Queries marked as slow in logs but seem normal

**Causes:**
1. Lock contention (query waiting for locks)
2. Transaction holding connections
3. Connection pool exhaustion

**Resolution:**
```sql
-- Check for long-running queries
SELECT pid, usename, query, state, query_start 
FROM pg_stat_activity 
WHERE state = 'active' 
  AND query_start < now() - interval '1 second'
ORDER BY query_start;

-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;
```

---

## 7. Success Criteria

✅ **Monitoring is successful when:**

1. **Slow query logs are generated** - Azure logs contain query entries
2. **Prometheus metrics are emitted** - `/metrics` shows `database_slow_queries_total`
3. **Dashboard displays live data** - Real-time updates visible
4. **Analyzer provides insights** - `analyze_slow_queries.py` produces meaningful output

---

## 8. What's Next

### Immediate (Next 48 Hours)
- [ ] Monitor dashboard during peak usage hours
- [ ] Run first slow query analysis
- [ ] Identify top 3 slowest endpoints

### Short Term (Next Week)
- [ ] Set up automated daily reports (cron job)
- [ ] Create Grafana dashboard (optional)
- [ ] Document optimization wins

### Long Term (Next Month)
- [ ] Establish performance budgets (e.g., "no endpoint > 500ms p95")
- [ ] Implement automatic alerting
- [ ] Build historical trend analysis

---

## Quick Reference

```bash
# Check Azure PostgreSQL log settings
az postgres flexible-server parameter list \
  --resource-group SMB-Loyalty-Group \
  --server-name loyalty-pg-db \
  --query "[?name contains 'log'].{Name:name, Value:value}" \
  -o table

# Analyze recent slow queries
cd Backend && python scripts/analyze_slow_queries.py --hours 24

# Launch real-time dashboard
python scripts/performance_dashboard.py

# View Prometheus metrics
curl http://localhost:8000/metrics | grep -E "(slow_queries|query_duration)"

# Check application logs for slow queries
grep "Slow query detected" logs/app.log | tail -20
```

---

**✅ Monitoring setup complete! All tools tested and operational.**
