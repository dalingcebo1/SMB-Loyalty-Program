# SMB Loyalty Program - Production Deployment Guide

## 🚀 Quick Start Deployment

### Prerequisites
- Docker and Docker Compose installed
- Domain name with SSL certificate
- PostgreSQL database (or use included Docker setup)
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
# Run database migrations
docker-compose exec backend alembic upgrade head

# Create initial admin user (optional)
docker-compose exec backend python scripts/create_admin.py
```

### 7. SSL/TLS Configuration

Update `nginx.conf` for SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # Backend API
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Frontend
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
    }
}
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
