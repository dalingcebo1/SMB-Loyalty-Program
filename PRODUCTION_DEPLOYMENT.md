# SMB Loyalty Program Production Deployment Guide

## Environment Variables Required for Production

Create a `.env` file in the Backend directory with these settings:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname

# Security
JWT_SECRET=your-256-bit-secret-key-here
RESET_SECRET=your-reset-token-secret-here
SECRET_KEY=your-loyalty-secret-here

# Payment Processing
YOCO_SECRET_KEY=your-yoco-live-secret-key
YOCO_WEBHOOK_SECRET=your-yoco-webhook-secret

# Email
SENDGRID_API_KEY=your-sendgrid-api-key
RESET_EMAIL_FROM=noreply@yourdomain.com

# Frontend
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com

# Firebase (for auth)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-service-account.json

# Production Settings
ENVIRONMENT=production
ENABLE_DEV_DANGEROUS=false
ENABLE_RATE_LIMIT_OVERRIDES=false
STATIC_DIR=/app/static

# Rate Limiting
RATE_LIMIT_PUBLIC_META_CAPACITY=100
RATE_LIMIT_PUBLIC_META_WINDOW=60
```

## Critical Production Checklist

### 1. Payment Integration ✅
- [x] Yoco integration implemented
- [x] Webhook signature verification
- [x] Payment status tracking
- [ ] Subscription recurring billing (implement below)

### 2. Environment Security ✅
- [x] Environment-based configuration
- [x] Secret key management
- [x] Rate limiting configuration
- [ ] SSL/TLS configuration (deployment)

### 3. Database & Persistence ✅
- [x] PostgreSQL support via DATABASE_URL
- [x] Migration system (Alembic)
- [x] Data backup strategy needed

### 4. Monitoring & Observability
- [x] Request timing middleware
- [x] Audit logging
- [ ] Error reporting integration
- [ ] Health check endpoints

## Next Steps for Launch

1. **Complete subscription billing** (implement recurring charges)
2. **Set up monitoring** (Sentry, health checks)
3. **Configure deployment** (Docker, cloud hosting)
4. **Test payment flows** end-to-end
