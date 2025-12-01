# Technical Specification: Deployment & Infrastructure

**Document Version:** 1.0  
**Last Updated:** December 1, 2025  
**Classification:** Confidential - Internal Use Only

---

## Table of Contents

1. [Infrastructure Overview](#infrastructure-overview)
2. [Azure Resources](#azure-resources)
3. [Deployment Pipeline](#deployment-pipeline)
4. [Environment Configuration](#environment-configuration)
5. [Scaling Strategy](#scaling-strategy)
6. [Monitoring & Observability](#monitoring--observability)
7. [Security Hardening](#security-hardening)
8. [Disaster Recovery](#disaster-recovery)

---

## 1. Infrastructure Overview

### 1.1 Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Front Door (CDN)                    │
│              SSL Termination, WAF, DDoS Protection           │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
┌───────▼────────┐         ┌────────▼──────────┐
│  Static Web    │         │  Container Apps   │
│  Apps (SWA)    │         │  (Backend API)    │
│                │         │                   │
│  React SPA     │◄────────┤  FastAPI          │
│  Vite Build    │  API    │  Gunicorn+Uvicorn │
└────────────────┘  Calls  │  Auto-scaling     │
                            └─────────┬─────────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                ┌────────▼────────┐       ┌───────▼──────────┐
                │  PostgreSQL     │       │  Redis Cache     │
                │  Flexible       │       │  Premium P1      │
                │  Server         │       │  6GB Memory      │
                │                 │       │                  │
                │  HA enabled     │       │  Persistence ON  │
                └─────────────────┘       └──────────────────┘
```

### 1.2 Technology Stack Summary
- **Frontend Hosting:** Azure Static Web Apps (Standard tier)
- **Backend Hosting:** Azure Container Apps (Consumption plan)
- **Database:** Azure Database for PostgreSQL Flexible Server
- **Cache:** Azure Cache for Redis (Premium P1)
- **CDN:** Azure Front Door Standard
- **Storage:** Azure Blob Storage (for uploads)
- **Monitoring:** Azure Monitor + Application Insights
- **CI/CD:** GitHub Actions

---

## 2. Azure Resources

### 2.1 Resource Groups

#### Development Environment
```
Resource Group: rg-smb-loyalty-dev
Location: South Africa North
Resources:
  - SMBstaticwebapp (Static Web App)
  - apismbloyaltyapp-dev (Container App)
  - postgres-smb-loyalty-dev (PostgreSQL)
  - redis-smb-loyalty-dev (Redis)
```

#### Production Environment
```
Resource Group: rg-smb-loyalty-prod
Location: South Africa North
Resources:
  - SMBstaticwebapp-prod (Static Web App)
  - apismbloyaltyapp-prod (Container App)
  - postgres-smb-loyalty-prod (PostgreSQL)
  - redis-smb-loyalty-prod (Redis)
  - frontdoor-smb-loyalty (Azure Front Door)
```

---

### 2.2 Azure Static Web Apps

#### Configuration
```yaml
Name: SMBstaticwebapp
SKU: Standard
Custom Domains:
  - orange-pond-06eea490f.3.azurestaticapps.net (default)
  - *.loyalty.app (wildcard for tenant subdomains)
  - Custom tenant domains (configured per-tenant)

Build Configuration:
  output_location: "dist"
  app_location: "Frontend"
  
Routing Rules: (staticwebapp.config.json)
  - SPA fallback to /index.html
  - API proxy to backend Container Apps
  - Custom headers for security
```

#### staticwebapp.config.json
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/assets/*"]
  },
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html",
      "statusCode": 200
    }
  },
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"]
    }
  ],
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  }
}
```

---

### 2.3 Azure Container Apps

#### Backend Configuration
```yaml
Name: apismbloyaltyapp-dev
Environment: managedEnvironment-rg-smb-loyalty
Container:
  Image: ghcr.io/dalingcebo1/smb-loyalty-backend:latest
  CPU: 0.5 cores
  Memory: 1.0 Gi
  
Scaling:
  Min Replicas: 1 (dev), 2 (prod)
  Max Replicas: 10
  Rules:
    - HTTP: Scale on concurrent requests > 100
    - CPU: Scale when CPU > 70%

Ingress:
  External: Enabled
  Target Port: 8000
  Traffic: 100% to latest revision
  
Environment Variables:
  - DATABASE_URL (secret)
  - REDIS_URL (secret)
  - FIREBASE_CREDENTIALS (secret)
  - ENV (value: production)
```

#### Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY Backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY Backend/ .

# Non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start server
CMD ["gunicorn", "app.main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
```

---

### 2.4 PostgreSQL Flexible Server

#### Configuration
```yaml
Name: postgres-smb-loyalty-prod
SKU: Standard_D4s_v3 (4 vCores, 16 GB RAM)
Storage: 256 GB (auto-grow enabled)
Version: PostgreSQL 15
High Availability: Zone-redundant (prod only)
Backup:
  Retention: 35 days
  Geo-redundant: Enabled (prod)

Connection Settings:
  SSL: Required
  Max Connections: 500
  Connection Pooling: PgBouncer enabled

Firewall:
  - Allow Azure services
  - Container Apps subnet
  - Admin IP allowlist
```

#### Performance Tuning
```sql
-- postgresql.conf optimizations
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1  -- SSD optimized
effective_io_concurrency = 200
work_mem = 10MB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
```

---

### 2.5 Redis Cache

#### Configuration
```yaml
Name: redis-smb-loyalty-prod
SKU: Premium P1 (6 GB)
Clustering: Disabled (enable when needed)
Persistence: RDB snapshot every 60 minutes
Replication: Enabled (geo-replication for prod)

Access:
  SSL: Required
  Port: 6380 (SSL)
  
Eviction Policy: allkeys-lru
Max Memory Policy: allkeys-lru

Connection Settings:
  Max Connections: 10000
  Timeout: 300 seconds
```

#### Cache Strategy
```python
# Tenant metadata: 1 hour TTL
cache_key = f"tenant:meta:{tenant_id}"
ttl = 3600

# User sessions: 24 hours TTL
cache_key = f"session:{user_id}"
ttl = 86400

# Inventory: 5 minutes TTL
cache_key = f"inventory:{tenant_id}:{vertical}"
ttl = 300

# Rate limiting: 1 minute sliding window
cache_key = f"ratelimit:{ip}:{endpoint}"
ttl = 60
```

---

## 3. Deployment Pipeline

### 3.1 GitHub Actions Workflow

#### Frontend Deployment (.github/workflows/frontend.yml)
```yaml
name: Frontend CI/CD

on:
  push:
    branches: [main, develop]
    paths:
      - 'Frontend/**'
      - '.github/workflows/frontend.yml'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: Frontend/package-lock.json
      
      - name: Install dependencies
        run: cd Frontend && npm ci
      
      - name: Lint
        run: cd Frontend && npm run lint
      
      - name: Type check
        run: cd Frontend && npm run type-check
      
      - name: Run tests
        run: cd Frontend && npm test
      
      - name: Build
        run: cd Frontend && npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_FIREBASE_CONFIG: ${{ secrets.VITE_FIREBASE_CONFIG }}
      
      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "Frontend"
          output_location: "dist"
```

#### Backend Deployment (.github/workflows/backend.yml)
```yaml
name: Backend CI/CD

on:
  push:
    branches: [main, develop]
    paths:
      - 'Backend/**'
      - '.github/workflows/backend.yml'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - name: Install dependencies
        run: cd Backend && pip install -r requirements.txt -r requirements-dev.txt
      
      - name: Run tests
        run: cd Backend && pytest
      
      - name: Type check
        run: cd Backend && mypy app/
      
      - name: Lint
        run: cd Backend && ruff check app/
  
  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Backend/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
            ghcr.io/${{ github.repository }}/backend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Deploy to Azure Container Apps
        uses: azure/container-apps-deploy-action@v1
        with:
          acrName: ${{ secrets.AZURE_CONTAINER_REGISTRY }}
          containerAppName: apismbloyaltyapp-prod
          resourceGroup: rg-smb-loyalty-prod
          imageToDeploy: ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
```

---

### 3.2 Branch Strategy

```
main (production)
  │
  ├─ develop (staging)
  │   │
  │   ├─ feature/schema-per-tenant
  │   ├─ feature/vertical-modules
  │   └─ bugfix/branding-cache
  │
  └─ hotfix/critical-security-patch
```

**Rules:**
- `main` → production deployment (requires PR approval)
- `develop` → staging deployment (auto-deploy on push)
- `feature/*` → no auto-deploy (manual testing in dev)
- `hotfix/*` → fast-track to main after testing

---

## 4. Environment Configuration

### 4.1 Environment Variables

#### Backend (.env.production)
```bash
# Database
DATABASE_URL=postgresql://user:pass@postgres-smb-loyalty-prod.postgres.database.azure.com/loyalty_db
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30

# Redis
REDIS_URL=rediss://redis-smb-loyalty-prod.redis.cache.windows.net:6380
REDIS_PASSWORD=<secret>
REDIS_DB=0

# Firebase
FIREBASE_CREDENTIALS=<base64-encoded-json>
FIREBASE_PROJECT_ID=smb-loyalty-app

# Security
SECRET_KEY=<generated-secret>
CORS_ORIGINS=https://orange-pond-06eea490f.3.azurestaticapps.net,https://*.loyalty.app
ALLOWED_HOSTS=*.azurecontainerapps.io

# Feature Flags
ENABLE_RATE_LIMITING=true
ENABLE_CACHING=true
ENABLE_ANALYTICS=true

# Environment
ENV=production
LOG_LEVEL=INFO
SENTRY_DSN=<sentry-url>
```

#### Frontend (.env.production)
```bash
VITE_API_URL=https://apismbloyaltyapp-prod.azurecontainerapps.io
VITE_FIREBASE_API_KEY=<key>
VITE_FIREBASE_AUTH_DOMAIN=smb-loyalty-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=smb-loyalty-app
VITE_ENV=production
```

---

### 4.2 Secrets Management

#### Azure Key Vault
```yaml
Key Vault: kv-smb-loyalty-prod
Access Policies:
  - Container Apps managed identity: Get, List secrets
  - GitHub Actions service principal: Get secrets

Secrets:
  - database-connection-string
  - redis-password
  - firebase-credentials
  - jwt-secret-key
  - stripe-api-key
```

#### GitHub Secrets
```yaml
Repository Secrets:
  - AZURE_STATIC_WEB_APPS_API_TOKEN
  - AZURE_CONTAINER_REGISTRY
  - AZURE_CREDENTIALS
  - VITE_FIREBASE_CONFIG
  - SENTRY_AUTH_TOKEN
```

---

## 5. Scaling Strategy

### 5.1 Horizontal Scaling

#### Container Apps Auto-scaling
```yaml
Scale Rules:
  - Name: http-rule
    Type: http
    Metadata:
      concurrentRequests: 100
    
  - Name: cpu-rule
    Type: cpu
    Metadata:
      type: Utilization
      value: 70
  
  - Name: schedule-rule
    Type: cron
    Metadata:
      timezone: Africa/Johannesburg
      start: "0 6 * * 1-5"  # Scale up weekdays 6 AM
      end: "0 22 * * 1-5"   # Scale down weekdays 10 PM
      desiredReplicas: 5
```

---

### 5.2 Database Scaling

#### Read Replicas (Future)
```yaml
Primary: postgres-smb-loyalty-prod (writes)
Read Replicas:
  - postgres-smb-loyalty-prod-replica-1 (reads)
  - postgres-smb-loyalty-prod-replica-2 (analytics)

Connection Routing:
  - Write queries → primary
  - Read queries → round-robin replicas
  - Long-running analytics → dedicated replica
```

---

### 5.3 Cache Scaling

#### Redis Clustering (When P1 saturates)
```yaml
Current: Premium P1 (6 GB, single node)
Upgrade Path: Premium P4 (26 GB, clustered)

Cluster Configuration:
  Shards: 3
  Replicas per shard: 1
  Total nodes: 6
  
Sharding Strategy:
  Key pattern: {tenant_id}:*
  Hash slot distribution: Consistent hashing
```

---

## 6. Monitoring & Observability

### 6.1 Application Insights

#### Metrics to Track
```yaml
Backend:
  - Request rate (requests/sec)
  - Response time (P50, P95, P99)
  - Error rate (4xx, 5xx)
  - Database query time
  - Cache hit rate
  - Tenant resolution time

Frontend:
  - Page load time
  - Time to interactive (TTI)
  - JavaScript errors
  - API call failures
  - User journey completions

Business:
  - Orders per minute
  - Revenue per hour
  - Active users
  - Loyalty redemptions
```

---

### 6.2 Alerting Rules

```yaml
Critical Alerts (PagerDuty):
  - Error rate > 5% for 5 minutes
  - P99 latency > 5 seconds for 5 minutes
  - Database connection pool exhausted
  - Container app replica crashes repeatedly

Warning Alerts (Email):
  - Error rate > 2% for 10 minutes
  - Cache hit rate < 80%
  - Disk usage > 80%
  - SSL certificate expiring in 30 days
```

---

### 6.3 Logging Strategy

#### Structured Logging
```python
import structlog

logger = structlog.get_logger()

logger.info(
    "order_created",
    order_id=order.id,
    user_id=user.id,
    tenant_id=tenant.id,
    total_cents=order.total_cents,
    vertical=order.vertical
)
```

#### Log Aggregation
```yaml
Sink: Azure Monitor Logs
Retention: 90 days (30 days hot, 60 days cold)
Queries:
  - Error investigation
  - Performance analysis
  - Audit trails
  - Security incident response
```

---

## 7. Security Hardening

### 7.1 Network Security

#### Container Apps
```yaml
Ingress:
  - Allow only HTTPS
  - Restrict to Azure Front Door IPs
  - Enable IP filtering for admin endpoints

VNet Integration:
  - Backend in private subnet
  - Database in private endpoint
  - No public internet access for backend
```

---

### 7.2 Application Security

#### Headers
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

#### Rate Limiting
```python
# Per-IP limits
RATE_LIMITS = {
    "/api/auth/login": "5 per minute",
    "/api/orders": "10 per minute",
    "/api/*": "100 per minute"
}
```

---

### 7.3 Secrets Rotation

```yaml
Schedule:
  - Database passwords: Every 90 days
  - API keys: Every 180 days
  - JWT secrets: Every 365 days
  - TLS certificates: Auto-renew via Let's Encrypt

Process:
  1. Generate new secret in Key Vault
  2. Update application configuration
  3. Rolling restart containers
  4. Verify new secret works
  5. Deactivate old secret after 24 hours
```

---

## 8. Disaster Recovery

### 8.1 Backup Strategy

```yaml
Database:
  Full Backup: Daily at 2 AM UTC
  Incremental: Every 6 hours
  Retention: 35 days
  
Redis:
  RDB Snapshot: Every hour
  AOF: Disabled (performance)
  
Code:
  Git repository: GitHub (backed up by GitHub)
  Container images: GHCR (retained for 90 days)
```

---

### 8.2 Recovery Procedures

#### Database Recovery
```bash
# Point-in-time restore
az postgres flexible-server restore \
  --resource-group rg-smb-loyalty-prod \
  --name postgres-smb-loyalty-prod-restored \
  --source-server postgres-smb-loyalty-prod \
  --restore-time "2025-12-01T10:30:00Z"
```

#### Application Recovery
```bash
# Rollback to previous container image
az containerapp revision copy \
  --name apismbloyaltyapp-prod \
  --resource-group rg-smb-loyalty-prod \
  --from-revision previous-revision-name
```

---

### 8.3 RTO/RPO Targets

```yaml
Production:
  RTO (Recovery Time Objective): 1 hour
  RPO (Recovery Point Objective): 5 minutes
  
Development:
  RTO: 4 hours
  RPO: 24 hours
```

---

**End of Deployment & Infrastructure Specification**
