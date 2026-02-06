# SMB Loyalty Platform - Developer Setup Guide

**Last Updated**: February 6, 2026  
**Version**: 2.0  
**Target Audience**: Backend developers setting up local development environment

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Provider Configuration](#provider-configuration)
5. [Database Setup](#database-setup)
6. [Running the Application](#running-the-application)
7. [Testing](#testing)
8. [Common Issues](#common-issues)
9. [Development Workflow](#development-workflow)

---

## Prerequisites

### Required Software

- **Python**: 3.12+ (3.12.3 recommended)
- **PostgreSQL**: 15+ (Docker recommended)
- **Node.js**: 18+ (for frontend, optional)
- **Git**: Latest version
- **Docker** (optional but recommended for database)

### Optional Tools

- **Redis**: 7+ (for caching, optional)
- **VS Code**: Recommended IDE with Python extension
- **Postman/Insomnia**: API testing (or use Swagger UI)

### External Accounts (Optional)

For full functionality, create free accounts:
- **Twilio**: SMS sending ([sign up](https://www.twilio.com/try-twilio))
- **SendGrid**: Email sending ([sign up](https://signup.sendgrid.com/))
- **Groq**: AI content generation ([sign up](https://console.groq.com/))
- **Stripe**: Payment processing ([sign up](https://dashboard.stripe.com/register))

---

## Quick Start

**Get running in 5 minutes:**

```bash
# 1. Clone repository
git clone https://github.com/dalingcebo1/SMB-Loyalty-Program.git
cd SMB-Loyalty-Program

# 2. Start PostgreSQL (Docker)
docker run --name smb-postgres -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=smbloyal -p 5433:5432 -d postgres:15

# 3. Setup Python environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
cd Backend
pip install -r requirements.txt

# 4. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your database connection

# 5. Run migrations
alembic upgrade head

# 6. Start server
uvicorn main:app --reload --port 8000

# 7. Open browser
# API Docs: http://localhost:8000/docs
# Health Check: http://localhost:8000/health/ready
```

**Server ready!** 🚀

---

## Detailed Setup

### 1. Clone Repository

```bash
git clone https://github.com/dalingcebo1/SMB-Loyalty-Program.git
cd SMB-Loyalty-Program
```

**Branch Strategy**:
- `main`: Production-ready code
- `develop`: Active development (checkout this for local dev)

```bash
git checkout develop
```

### 2. Python Virtual Environment

**Why**: Isolates project dependencies from system Python.

```bash
# Create virtual environment
python3 -m venv .venv

# Activate (Linux/Mac)
source .venv/bin/activate

# Activate (Windows)
.venv\Scripts\activate

# Verify activation (should show .venv path)
which python
```

### 3. Install Dependencies

```bash
cd Backend
pip install --upgrade pip
pip install -r requirements.txt
```

**Expected output**: 40+ packages installed (~500MB)

**Verify installation**:
```bash
python -c "import fastapi, sqlalchemy, twilio, sendgrid; print('✓ All imports successful')"
```

### 4. Database Setup

#### Option A: Docker (Recommended)

```bash
# Start PostgreSQL container
docker run \
  --name smb-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=smbloyal \
  -p 5433:5432 \
  -d postgres:15

# Verify running
docker ps | grep smb-postgres

# View logs
docker logs smb-postgres
```

**Connection String**: `postgresql://postgres:dev@localhost:5433/smbloyal`

#### Option B: Local PostgreSQL

**Install PostgreSQL 15**:
- **Mac**: `brew install postgresql@15`
- **Ubuntu**: `sudo apt install postgresql-15`
- **Windows**: Download installer from [postgresql.org](https://www.postgresql.org/download/windows/)

**Create database**:
```bash
createdb smbloyal
```

**Connection String**: `postgresql://postgres:yourpassword@localhost:5432/smbloyal`

#### Option C: Use Existing Docker Compose

```bash
cd $PROJECT_ROOT
docker-compose -f docker-compose.local-db.yml up -d
```

**Connection String**: See `docker-compose.local-db.yml` for credentials

### 5. Environment Configuration

```bash
cd Backend
cp .env.local.example .env.local
```

**Edit `.env.local`** with your settings:

```bash
# === Core Settings ===
DATABASE_URL=postgresql://postgres:dev@localhost:5433/smbloyal
JWT_SECRET=your-super-secret-jwt-key-change-me-32-chars-min
SECRET_KEY=your-super-secret-app-key-change-me-32-chars-min
ENVIRONMENT=development

# === Frontend URL ===
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# === SMS Provider (Optional) ===
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+27821234567

# === Email Provider (Optional) ===
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=dev@yourdomain.com

# === AI Content Generation (Optional) ===
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OLLAMA_API_URL=http://localhost:11434

# === Payment Processing (Optional) ===
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx

# === Redis Caching (Optional) ===
REDIS_URL=redis://localhost:6379/0
ENABLE_CACHE=true

# === Firebase (Optional) ===
GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-credentials.json
FIREBASE_PROJECT_ID=your-project-id
```

**Security Notes**:
- ⚠️ **Never** commit `.env.local` to git (already in `.gitignore`)
- 🔑 Use strong random strings for `JWT_SECRET` and `SECRET_KEY` (32+ chars)
- 🔐 Keep all API keys secret

**Generate Random Secrets**:
```bash
# Linux/Mac
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Or use OpenSSL
openssl rand -base64 32
```

### 6. Database Migrations

**Run all migrations** to set up database schema:

```bash
cd Backend
alembic upgrade head
```

**Expected output**:
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> abc123def456, Initial schema
INFO  [alembic.runtime.migration] Running upgrade abc123def456 -> def456ghi789, Add campaigns
INFO  [alembic.runtime.migration] Running upgrade def456ghi789 -> ghi789jkl012, Add financial
```

**Verify tables created**:
```bash
psql postgresql://postgres:dev@localhost:5433/smbloyal -c "\dt"
```

**Should show**: 50+ tables including `users`, `tenants`, `campaigns`, `invoices`, etc.

### 7. Seed Data (Optional)

**Create admin user and test data**:

```bash
cd Backend
python scripts/seed_dev_data.py
```

**Creates**:
- Admin user: `admin@example.com` / `admin123`
- Demo tenant: `demo-business`
- Sample products, services, customers
- Test campaigns and invoices

**Skip this** if you want a clean database.

---

## Provider Configuration

### Twilio SMS Setup

**1. Sign up**: [twilio.com/try-twilio](https://www.twilio.com/try-twilio)

**2. Get credentials**:
- Go to: [Twilio Console](https://console.twilio.com/)
- Copy **Account SID** and **Auth Token**
- Navigate to **Phone Numbers** → Get a phone number (free trial)

**3. Configure webhooks**:
- Select your phone number
- Set **StatusCallback URL**: `https://yourdomain.com/api/providers/webhooks/twilio/status`
- Set **Method**: `POST`
- Save

**4. Add to `.env.local`**:
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567  # Your Twilio number
```

**Test**:
```bash
curl -X POST "http://localhost:8000/api/providers/test/sms" \
  -d "to_phone=+27821234567" \
  -d "message=Test from SMB Platform"
```

### SendGrid Email Setup

**1. Sign up**: [signup.sendgrid.com](https://signup.sendgrid.com/)

**2. Create API key**:
- Go to: [SendGrid Dashboard](https://app.sendgrid.com/)
- Navigate to **Settings** → **API Keys**
- Click **Create API Key**
- Name: `SMB Loyalty Dev`
- Permissions: **Full Access** (or Restricted with Mail Send)
- Copy the key (only shown once!)

**3. Verify sender**:
- Navigate to **Settings** → **Sender Authentication**
- Add your email address and verify
- Or set up domain authentication (recommended for production)

**4. Configure webhooks**:
- Navigate to **Settings** → **Mail Settings** → **Event Webhook**
- Enable
- Set **HTTP POST URL**: `https://yourdomain.com/api/providers/webhooks/sendgrid/events`
- Enable events: `delivered`, `open`, `click`, `bounce`, `spam_report`, `unsubscribe`
- Save

**5. Add to `.env.local`**:
```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=dev@yourdomain.com  # Must match verified sender
```

**Test**:
```bash
curl -X POST "http://localhost:8000/api/providers/test/email" \
  -d "to_email=your-email@example.com" \
  -d "subject=Test Email" \
  -d "message=This is a test from SMB Platform"
```

### Groq AI Setup (Optional)

**1. Sign up**: [console.groq.com](https://console.groq.com/)

**2. Create API key**:
- Navigate to **API Keys**
- Click **Create API Key**
- Copy the key

**3. Add to `.env.local`**:
```bash
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Note**: Free tier includes 14,400 tokens/min (Llama 3)

### Stripe Payment Setup (Optional)

**1. Sign up**: [dashboard.stripe.com/register](https://dashboard.stripe.com/register)

**2. Get test keys**:
- Go to: [Stripe Dashboard](https://dashboard.stripe.com/)
- Toggle **Test mode** (top right)
- Navigate to **Developers** → **API keys**
- Copy **Secret key** (`sk_test_...`)

**3. Configure webhook**:
- Navigate to **Developers** → **Webhooks**
- Add endpoint: `https://yourdomain.com/webhooks/stripe`
- Select events: `payment_intent.succeeded`, `subscription.updated`, etc.
- Copy **Signing secret** (`whsec_...`)

**4. Add to `.env.local`**:
```bash
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Running the Application

### Backend Server

```bash
cd Backend
source ../.venv/bin/activate  # If not already activated
uvicorn main:app --reload --port 8000
```

**Options**:
- `--reload`: Auto-restart on code changes (dev only)
- `--port 8000`: Listen on port 8000
- `--host 0.0.0.0`: Allow external connections
- `--workers 4`: Run with 4 worker processes (production)

**Expected output**:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Prometheus metrics middleware enabled
INFO:     Application startup complete.
```

**Access Points**:
- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **ReDoc**: http://localhost:8000/redoc (Alternative API docs)
- **Health Check**: http://localhost:8000/health/ready
- **Metrics**: http://localhost:8000/metrics (Prometheus format)

### Frontend (Optional)

**If you want to run the React frontend**:

```bash
cd Frontend
npm install
npm run dev
```

**Access**: http://localhost:3000

---

## Testing

### Manual API Testing

**Using Swagger UI** (recommended):
1. Open http://localhost:8000/docs
2. Click **Authorize** (lock icon top right)
3. Test endpoints interactively

**Using curl**:

```bash
# Health check
curl http://localhost:8000/health/ready

# Provider status
curl http://localhost:8000/api/providers/health

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Use token from response in subsequent requests
TOKEN="your-jwt-token"

# List campaigns
curl http://localhost:8000/api/campaigns \
  -H "Authorization: Bearer $TOKEN"
```

### Automated Testing

**Run pytest suite**:

```bash
cd Backend
pytest tests/ -v
```

**Run specific tests**:
```bash
pytest tests/test_campaigns.py -v
pytest tests/test_financial.py::test_create_invoice -v
```

**Test coverage**:
```bash
pytest --cov=app --cov-report=html
# Open htmlcov/index.html in browser
```

**Note**: Some tests may fail due to pre-existing import issues (documented, not related to new features).

### Provider Integration Testing

**Test SMS** (requires Twilio credentials):
```bash
curl -X POST "http://localhost:8000/api/providers/test/sms" \
  -d "to_phone=+27821234567" \
  -d "message=Integration test"
```

**Test Email** (requires SendGrid credentials):
```bash
curl -X POST "http://localhost:8000/api/providers/test/email" \
  -d "to_email=your-email@example.com" \
  -d "subject=Integration Test" \
  -d "message=Test email body"
```

---

## Common Issues

### Database Connection Failed

**Error**: `could not connect to server: Connection refused`

**Solutions**:
1. Verify PostgreSQL running: `docker ps | grep postgres`
2. Check port: Ensure 5433 not in use (`lsof -i :5433`)
3. Verify connection string in `.env.local`
4. Test connection: `psql postgresql://postgres:dev@localhost:5433/smbloyal`

### Import Errors

**Error**: `ModuleNotFoundError: No module named 'app'`

**Solutions**:
1. Activate virtual environment: `source .venv/bin/activate`
2. Reinstall dependencies: `pip install -r requirements.txt`
3. Set PYTHONPATH: `export PYTHONPATH=/path/to/Backend:$PYTHONPATH`

### Port Already in Use

**Error**: `Address already in use`

**Solutions**:
```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>

# Or use different port
uvicorn main:app --port 8001
```

### Migration Errors

**Error**: `Target database is not up to date`

**Solutions**:
```bash
# Check current migration version
alembic current

# Upgrade to latest
alembic upgrade head

# If corrupted, reset (WARNING: data loss)
alembic downgrade base
alembic upgrade head
```

### Provider Not Configured

**Warning**: `Twilio not configured - SMS sending disabled`

**Solutions**:
1. Add credentials to `.env.local` (see Provider Configuration above)
2. Restart server: `Ctrl+C` then `uvicorn main:app --reload`
3. Verify: `curl http://localhost:8000/api/providers/health`

---

## Development Workflow

### Making Code Changes

**1. Create feature branch**:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-new-feature
```

**2. Make changes**:
- Edit code in `Backend/app/`
- Server auto-reloads with `--reload` flag
- Test changes in Swagger UI or with pytest

**3. Run quality checks**:
```bash
cd Backend

# Format code
ruff format .

# Lint
ruff check .

# Type check
mypy .

# Run tests
pytest tests/ -v
```

**4. Commit and push**:
```bash
git add .
git commit -m "feat: Add new feature"
git push origin feature/my-new-feature
```

**5. Create Pull Request**:
- Target branch: `develop`
- CI runs automatically (backend tests, frontend tests, linting)
- Request review

### Adding a New API Endpoint

**1. Create route function**:

```python
# Backend/app/routes/my_module.py
from fastapi import APIRouter, Depends
from app.core.tenant_context import get_tenant_context, TenantContext

router = APIRouter()

@router.get("/my-endpoint")
async def my_endpoint(
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    return {"message": "Hello from new endpoint"}
```

**2. Register router**:

```python
# Backend/main.py
from app.routes.my_module import router as my_router

router_mounts = [
    # ... existing routers
    ("/api/my", my_router),
]
```

**3. Test**:
```bash
curl http://localhost:8000/api/my/my-endpoint
```

### Database Schema Changes

**1. Create migration**:
```bash
cd Backend
alembic revision --autogenerate -m "Add new table"
```

**2. Review generated migration** in `Backend/alembic/versions/`

**3. Apply migration**:
```bash
alembic upgrade head
```

**4. Test rollback**:
```bash
alembic downgrade -1
alembic upgrade head
```

### Debugging

**VS Code Launch Configuration** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI",
      "type": "debugpy",
      "request": "launch",
      "module": "uvicorn",
      "args": [
        "main:app",
        "--reload",
        "--port",
        "8000"
      ],
      "jinja": true,
      "cwd": "${workspaceFolder}/Backend",
      "env": {
        "PYTHONPATH": "${workspaceFolder}/Backend"
      }
    }
  ]
}
```

**Set breakpoints** and press F5 to start debugging.

---

## Next Steps

### For Backend Development
1. ✅ Complete this setup guide
2. 📖 Read [API_DOCUMENTATION.md](../API_DOCUMENTATION.md)
3. 🏗️ Review [ARCHITECTURE_IMPROVEMENTS_PHASE_5-8_COMPLETE.md](../ARCHITECTURE_IMPROVEMENTS_PHASE_5-8_COMPLETE.md)
4. 📝 Check [PHASE_5_WEEK_11_COMPLETE.md](../PHASE_5_WEEK_11_COMPLETE.md) for provider integrations
5. 🧪 Run tests: `pytest tests/ -v`

### For Full-Stack Development
1. ✅ Complete backend setup (this guide)
2. 🌐 Setup frontend: See `Frontend/README.md`
3. 🔗 Test end-to-end flows
4. 📚 Review [FRONTEND_INTEGRATION_GUIDE.md](../FRONTEND_INTEGRATION_GUIDE.md)

### For Production Deployment
1. 🔐 Review [DEPLOYMENT_HARDENING.md](../DEPLOYMENT_HARDENING.md)
2. ☁️ Follow [AZURE_DEPLOYMENT_STEPS.md](../AZURE_DEPLOYMENT_STEPS.md)
3. 🚨 Setup monitoring and alerting
4. 📊 Configure production environment variables

---

## Support & Resources

### Documentation
- **API Docs**: http://localhost:8000/docs (when running)
- **Main README**: [../README.md](../README.md)
- **Development Roadmap**: [../DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md)

### Getting Help
- **GitHub Issues**: Create an issue for bugs or questions
- **Pull Requests**: Contribute improvements
- **Discussion**: Use GitHub Discussions for questions

### External Resources
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **SQLAlchemy Docs**: https://docs.sqlalchemy.org/
- **Twilio Docs**: https://www.twilio.com/docs
- **SendGrid Docs**: https://sendgrid.com/docs/

---

**Happy coding!** 🚀

If you run into issues, check the [Common Issues](#common-issues) section or create a GitHub issue with details about your environment and the error message.
