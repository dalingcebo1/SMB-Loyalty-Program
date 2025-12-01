# PostgreSQL Slow Query Logging Setup

**Date:** December 1, 2025  
**Purpose:** Enable slow query logging to identify performance bottlenecks

---

## Overview

Slow query logging helps identify database queries that exceed performance thresholds, enabling targeted optimization efforts. This guide covers setup for various PostgreSQL deployment scenarios.

---

## Configuration Parameters

### Key Settings

| Parameter | Recommended Value | Description |
|-----------|------------------|-------------|
| `log_min_duration_statement` | `1000` (1 second) | Log queries taking longer than this (milliseconds) |
| `log_statement` | `'mod'` | Log all data-modifying statements (INSERT, UPDATE, DELETE) |
| `log_duration` | `on` | Include query duration in logs |
| `log_line_prefix` | `'%t [%p]: [%l-1] user=%u,db=%d,app=%a '` | Structured log format with timestamp, PID, user, database |
| `log_connections` | `on` | Log new connections (helpful for connection pool monitoring) |
| `log_disconnections` | `on` | Log disconnections |
| `log_lock_waits` | `on` | Log queries waiting for locks |
| `deadlock_timeout` | `1s` | How long to wait before checking for deadlock |

---

## Setup by Environment

### 1. Azure PostgreSQL Flexible Server

**Via Azure Portal:**

1. Navigate to your PostgreSQL server in Azure Portal
2. Go to **Server parameters**
3. Update the following parameters:

```
log_min_duration_statement = 1000
log_statement = mod
log_duration = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a '
log_connections = on
log_disconnections = on
log_lock_waits = on
```

4. Click **Save** (server will reload automatically)

**Via Azure CLI:**

```bash
# Set resource group and server name
RG="SMB-Loyalty-Group"
SERVER="smb-loyalty-postgres"

# Enable slow query logging
az postgres flexible-server parameter set \
  --resource-group $RG \
  --server-name $SERVER \
  --name log_min_duration_statement \
  --value 1000

az postgres flexible-server parameter set \
  --resource-group $RG \
  --server-name $SERVER \
  --name log_statement \
  --value mod

az postgres flexible-server parameter set \
  --resource-group $RG \
  --server-name $SERVER \
  --name log_duration \
  --value on

az postgres flexible-server parameter set \
  --resource-group $RG \
  --server-name $SERVER \
  --name log_lock_waits \
  --value on
```

**View Logs:**

```bash
# Via Azure CLI (last 1 hour)
az postgres flexible-server server-logs list \
  --resource-group $RG \
  --server-name $SERVER

# Download specific log file
az postgres flexible-server server-logs download \
  --resource-group $RG \
  --server-name $SERVER \
  --name <log-file-name>
```

---

### 2. Local PostgreSQL (Development)

**Edit `postgresql.conf`:**

```bash
# Find config file location
sudo -u postgres psql -c "SHOW config_file;"

# Edit the file
sudo nano /etc/postgresql/15/main/postgresql.conf
```

**Add/Update these lines:**

```conf
# Logging configuration
log_min_duration_statement = 1000  # Log queries > 1 second
log_statement = 'mod'               # Log INSERT/UPDATE/DELETE
log_duration = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a '
log_connections = on
log_disconnections = on
log_lock_waits = on

# Optional: Log all queries (development only)
# log_statement = 'all'  # Uncomment to log every query (generates large logs)
```

**Restart PostgreSQL:**

```bash
sudo systemctl restart postgresql
```

**View Logs:**

```bash
# Default log location
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Or via journalctl
sudo journalctl -u postgresql -f
```

---

### 3. Docker Compose

**Update `docker-compose.yml`:**

```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: loyalty_db
    command: >
      postgres
      -c log_min_duration_statement=1000
      -c log_statement=mod
      -c log_duration=on
      -c log_line_prefix='%t [%p]: [%l-1] user=%u,db=%d,app=%a '
      -c log_connections=on
      -c log_lock_waits=on
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./logs/postgres:/var/log/postgresql
```

**View Logs:**

```bash
docker compose logs -f db | grep "duration:"
```

---

### 4. Runtime Configuration (Temporary)

For testing without restarting the server:

```sql
-- Connect as superuser
psql -U postgres -d loyalty_db

-- Enable slow query logging (session-level)
SET log_min_duration_statement = 1000;
SET log_statement = 'mod';

-- Enable for all future connections (requires superuser)
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_duration = on;

-- Reload configuration (no restart needed)
SELECT pg_reload_conf();

-- Verify settings
SHOW log_min_duration_statement;
SHOW log_statement;
```

---

## Log Analysis

### 1. Identify Slow Queries

**Parse logs for slow queries:**

```bash
# Grep for slow queries
grep "duration:" /var/log/postgresql/postgresql.log | \
  awk -F'duration: ' '{print $2}' | \
  sort -rn | \
  head -20

# Or with more context
grep -B2 "duration: [0-9][0-9][0-9][0-9]" /var/log/postgresql/postgresql.log
```

**Example log entry:**

```
2025-12-01 19:30:45.123 UTC [12345]: [1-1] user=loyalty_user,db=loyalty_db,app=fastapi 
LOG:  duration: 2543.871 ms  statement: SELECT * FROM orders WHERE tenant_id = 'abc123' 
ORDER BY created_at DESC
```

---

### 2. Query Performance Metrics

**Get query statistics (requires `pg_stat_statements` extension):**

```sql
-- Enable extension (once)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 10 slowest queries by average time
SELECT 
    calls,
    mean_exec_time::numeric(10,2) as avg_ms,
    max_exec_time::numeric(10,2) as max_ms,
    total_exec_time::numeric(10,2) as total_ms,
    LEFT(query, 80) as query_preview
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Most frequently executed queries
SELECT 
    calls,
    mean_exec_time::numeric(10,2) as avg_ms,
    total_exec_time::numeric(10,2) as total_ms,
    LEFT(query, 80) as query_preview
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

---

### 3. Automated Analysis Tools

**Install `pgBadger` (log analyzer):**

```bash
# Ubuntu/Debian
sudo apt-get install pgbadger

# macOS
brew install pgbadger

# Analyze logs
pgbadger /var/log/postgresql/postgresql.log \
  --outfile /tmp/postgres_report.html \
  --prefix '%t [%p]:'

# Open report
open /tmp/postgres_report.html  # macOS
xdg-open /tmp/postgres_report.html  # Linux
```

---

## Monitoring & Alerting

### 1. Add Prometheus Metrics

**Update `Backend/app/core/metrics.py`:**

```python
# Add slow query counter
slow_queries_total = Counter(
    'db_slow_queries_total',
    'Total number of slow queries (>1s)',
    ['query_type', 'tenant_id']
)
```

### 2. Create Grafana Dashboard

**Query for slow query rate:**

```promql
# Slow queries per minute
rate(db_slow_queries_total[5m]) * 60

# Slow queries by tenant
sum by (tenant_id) (rate(db_slow_queries_total[5m]))
```

### 3. Alert Rules

```yaml
# Alert when slow query rate exceeds threshold
- alert: HighSlowQueryRate
  expr: rate(db_slow_queries_total[5m]) > 0.5
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "High slow query rate detected"
    description: "More than 0.5 slow queries/sec for 10 minutes"
```

---

## Troubleshooting Common Slow Queries

### 1. Missing Index

**Symptom:** Sequential scan on large table

```sql
-- Identify table scans
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_tup_read DESC;

-- Add missing index
CREATE INDEX CONCURRENTLY idx_orders_tenant_status 
ON orders(tenant_id, status);
```

### 2. N+1 Query Problem

**Symptom:** Many similar queries in rapid succession

**Solution:** Use `selectinload()` or `joinedload()` in SQLAlchemy (already implemented in this PR)

### 3. Large Result Set

**Symptom:** Query returns thousands of rows

**Solution:** Add pagination (already implemented in this PR via `safe_limit()`)

### 4. Lock Contention

**Symptom:** Queries waiting for locks

```sql
-- View current locks
SELECT 
    pid,
    usename,
    pg_blocking_pids(pid) as blocked_by,
    query
FROM pg_stat_activity
WHERE wait_event_type = 'Lock';

-- Kill blocking query (last resort)
SELECT pg_terminate_backend(12345);  -- Replace with actual PID
```

---

## Production Best Practices

### 1. Start Conservative

- **Week 1:** `log_min_duration_statement = 5000` (5 seconds)
- **Week 2:** `log_min_duration_statement = 2000` (2 seconds)
- **Week 3:** `log_min_duration_statement = 1000` (1 second)
- **Ongoing:** Adjust based on 95th percentile query time

### 2. Log Rotation

**Ensure logs don't fill disk:**

```conf
# In postgresql.conf
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_truncate_on_rotation = on
```

### 3. Monitor Log Volume

```bash
# Check log disk usage
du -sh /var/log/postgresql/

# Alert if logs exceed 1GB
if [ $(du -s /var/log/postgresql/ | awk '{print $1}') -gt 1000000 ]; then
    echo "WARNING: PostgreSQL logs exceed 1GB"
fi
```

---

## Verification

**Confirm logging is enabled:**

```sql
-- Check current settings
SHOW log_min_duration_statement;
SHOW log_statement;
SHOW log_duration;

-- Test with a slow query
SELECT pg_sleep(2);
-- Should appear in logs with "duration: 2000.xxx ms"
```

**Expected log output:**

```
2025-12-01 19:45:23.456 UTC [12345]: [1-1] user=loyalty_user,db=loyalty_db,app=psql 
LOG:  duration: 2001.234 ms  statement: SELECT pg_sleep(2);
```

---

## Next Steps

1. ✅ Enable slow query logging in production
2. ✅ Monitor logs for 1 week to identify patterns
3. ✅ Prioritize optimization of queries appearing >10 times/day
4. ✅ Set up automated reports (weekly pgBadger analysis)
5. ✅ Create Grafana dashboard for real-time monitoring
6. ✅ Adjust threshold based on baseline performance

---

## Related Documentation

- [Database Performance Analysis](../PERFORMANCE_ANALYSIS.md)
- [Composite Indexes Migration](../../alembic/versions/42c7f6079484_add_performance_composite_indexes.py)
- [Pagination Utilities](../../app/utils/pagination.py)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/runtime-config-logging.html)
