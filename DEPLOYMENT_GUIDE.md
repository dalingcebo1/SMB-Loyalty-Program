# SMB Loyalty Program - Production Deployment Guide

## 🚀 Quick Start Deployment

### Azure Resources

**Development Environment:**
- Resource Group: `SMB-Loyalty-Group`
- Backend: `apismbloyaltyapp-dev` (Container App)
  - URL: `dev-loyalty-backend.mangoplant-11c2323f.southafricanorth.azurecontainerapps.io`
  - Environment: `smbloyalty-ca-env`
- Frontend: `SMBstaticwebapp` (Static Web Apps)
  - URL: `orange-pond-06eea490f.3.azurestaticapps.net`
- Database: Azure PostgreSQL Flexible Server

**Production Environment:**
- Backend: `apismbloyaltyapp` (Container App)
- Frontend: Production Static Web App (to be configured)

### Prerequisites
- Azure CLI installed and authenticated
- Azure Container Registry: `smblpcontainerregistry`
- Azure subscription with Container Apps and Static Web Apps enabled
- PostgreSQL database (Azure Flexible Server)
- Yoco payment gateway account
- Firebase project for authentication

### 1. Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd SMB-Loyalty-Program

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your production values
```

### 2. Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/loyalty_program

# Security
SECRET_KEY=your-secret-key-minimum-32-characters
ENVIRONMENT=production

# Payment Integration
YOCO_SECRET_KEY=your-yoco-secret-key
YOCO_WEBHOOK_SECRET=your-yoco-webhook-secret

# Firebase Authentication
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
```

### 3. Firebase Setup

1. Create Firebase project at https://console.firebase.google.com
2. Enable Authentication with Email/Password and Google providers
3. Download service account key as `firebase-credentials.json`
4. Place in project root directory

### 4. Yoco Payment Setup

1. Create Yoco account at https://www.yoco.com
2. Get API keys from dashboard
3. Configure webhook URL: `https://yourdomain.com/api/payments/yoco/webhook`
4. Set webhook secret in environment variables

### 5. Production Deployment

```bash
# Start all services
docker-compose up -d

# Check health status
curl https://yourdomain.com/health/detailed

# View logs
docker-compose logs -f
```

### 6. Database Migration

```bash
# Run database migrations via Azure Container Apps Console
# Navigate to: Azure Portal > Container Apps > apismbloyaltyapp-dev > Console
cd /app
alembic -c alembic.ini upgrade head

# Seed tenant domain mappings
python scripts/seed_tenant_domains.py

# Verify migration status
python -c "from sqlalchemy import create_engine, text; import os; engine = create_engine(os.environ['DATABASE_URL']); conn = engine.connect(); result = conn.execute(text('SELECT version_num FROM alembic_version')); print(f'Current migration: {result.scalar()}')"
```

### 7. Tenant Domain Configuration

The platform uses dynamic tenant resolution via the `tenant_domains` table:

**Domain Resolution Logic:**
1. Check `Host` header against `tenant_domains` table
2. Fallback to `X-Tenant-ID` header if domain not found
3. Fallback to `DEFAULT_TENANT` environment variable (dev/staging only)

**Seeded Domains (default tenant):**
- `orange-pond-06eea490f.3.azurestaticapps.net` (dev frontend)
- `localhost:5173` (local development)
- `127.0.0.1:5173` (local development)

**Adding New Tenant Domains:**
```bash
# Via Admin API
curl -X POST https://dev-loyalty-backend.mangoplant-11c2323f.southafricanorth.azurecontainerapps.io/api/admin/tenant-domains/ \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-slug",
    "domain": "custom-domain.example.com",
    "is_primary": true,
    "environment": "production"
  }'

# Via database
INSERT INTO tenant_domains (tenant_id, domain, is_primary, environment) 
VALUES ('tenant-slug', 'custom-domain.example.com', true, 'production');
```

**Lookup Domain Mapping:**
```bash
curl https://dev-loyalty-backend.mangoplant-11c2323f.southafricanorth.azurecontainerapps.io/api/admin/tenant-domains/lookup/orange-pond-06eea490f.3.azurestaticapps.net \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 8. SSL/TLS Configuration

**Azure Container Apps:**
SSL/TLS is automatically managed by Azure for `*.azurecontainerapps.io` domains.

**Custom Domains:**
1. Navigate to Azure Portal > Container Apps > `apismbloyaltyapp-dev`
2. Go to **Custom domains**
3. Add your custom domain
4. Azure will provide DNS records (CNAME or TXT) to verify ownership
5. SSL certificate is automatically provisioned via Azure's managed certificates

**Azure Static Web Apps:**
SSL/TLS is automatically managed. For custom domains:
1. Navigate to Azure Portal > Static Web Apps > `SMBstaticwebapp`
2. Go to **Custom domains**
3. Add domain and follow DNS verification steps
4. Azure provisions free SSL certificate automatically

**CORS Configuration:**
Backend automatically allows requests from configured `ALLOWED_ORIGINS`. Update via environment variable:
```bash
ALLOWED_ORIGINS=https://orange-pond-06eea490f.3.azurestaticapps.net,https://custom-domain.com
```

## 📊 Health Monitoring

### Health Check Endpoints

- `GET /health/` - Basic health status
- `GET /health/detailed` - Comprehensive system status
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe
- `GET /health/metrics` - Application metrics

### Example Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2025-01-08T11:47:33.031840",
  "service": "SMB Loyalty Program API",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful"
    },
    "environment": {
      "status": "healthy",
      "message": "All required environment variables present"
    },
    "resources": {
      "status": "healthy",
      "message": "System resources within normal limits",
      "details": {
        "memory_percent": 75.3,
        "disk_percent": 46.7
      }
    }
  }
}
```

## 🔒 Security Checklist

- [ ] All environment variables configured
- [ ] Strong SECRET_KEY generated (32+ characters)
- [ ] SSL/TLS certificates installed
- [ ] Firebase authentication configured
- [ ] Yoco webhook signature verification enabled
- [ ] Rate limiting configured
- [ ] Database access restricted
- [ ] Regular security updates scheduled

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check database status
   docker-compose logs db
   # Verify DATABASE_URL format
   ```

2. **Health Check Failing**
   ```bash
   # Check backend logs
   docker-compose logs backend
   # Test health endpoint directly
   curl http://localhost:8000/health/
   ```

3. **Payment Webhook Issues**
   ```bash
   # Verify webhook URL in Yoco dashboard
   # Check webhook secret matches environment
   # Review payment logs
   ```

## 📈 Performance Monitoring

### Key Metrics to Monitor

- Response times (target: <500ms)
- Error rates (target: <1%)
- Database connection pool usage
- Memory and CPU utilization
- Payment processing success rate

### Scaling Recommendations

- **Small Business**: 1 backend, 1 frontend, shared database
- **Medium Business**: 2 backend instances, load balancer
- **Enterprise**: Horizontal scaling with Redis cache

## 🎯 Launch Verification

### Pre-Launch Checklist

1. **System Health**
   - [ ] All health checks passing
   - [ ] Database migrations completed
   - [ ] SSL certificates valid

2. **Feature Validation**
   - [ ] User registration/login working
   - [ ] Subscription plan selection functional
   - [ ] Payment processing operational
   - [ ] Admin dashboard accessible

3. **Integration Testing**
   - [ ] Yoco webhook receiving events
   - [ ] Firebase authentication working
   - [ ] Email notifications sending

4. **Performance**
   - [ ] Page load times < 3 seconds
   - [ ] API response times < 500ms
   - [ ] No memory leaks detected

## 🎉 Post-Launch

### Monitoring Setup

1. Set up log aggregation (ELK stack recommended)
2. Configure alerting for critical errors
3. Monitor payment processing metrics
4. Track user onboarding funnel

### Maintenance Schedule

- **Daily**: Health check validation
- **Weekly**: Security updates
- **Monthly**: Performance review
- **Quarterly**: Feature updates

---

🚀 **Ready for Launch!** The SMB Loyalty Program is production-ready with comprehensive monitoring, security, and scalability features.
