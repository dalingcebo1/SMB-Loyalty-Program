# 🚀 Local Development Environment - Quick Reference

## ✅ Setup Complete!

Your local development database has been fully seeded to match the test environment.

---

## 🔐 Test Accounts

| Email | Password | Role | Use Case |
|-------|----------|------|----------|
| `dali.ngubane@chaosx.co.za` | `It7742001` | admin | Full admin access |
| `smblptest@gmail.com` | `It7742001` | admin | Test admin account |
| `dali.ngubane@gmail.com` | `It7742001` | staff | Staff operations |

---

## 🗄️ Database Status

**PostgreSQL Container:** `loyalty_local_db` (running on port 5433)

Current data:
- ✓ 1 Tenant (default)
- ✓ 3 Users (2 admin, 1 staff)
- ✓ 12 Car Wash Services
- ✓ 5 Extras (add-ons)
- ✓ 4 Vehicles
- ✓ 10 Sample Orders
- ✓ 10 Payments
- ✓ Visit counts initialized

---

## 🌐 Access URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Backend API** | http://localhost:8000 | FastAPI server |
| **Frontend** | http://localhost:5173 | Vite dev server |
| **API Docs** | http://localhost:8000/docs | Swagger UI |
| **Adminer** | http://localhost:8081 | Database UI |
| **Test Environment** | https://orange-pond-06eea490f.3.azurestaticapps.net | Azure deployment |

**Adminer Login:**
- System: `PostgreSQL`
- Server: `loyalty_local_db`
- Username: `postgres`
- Password: `postgres`
- Database: `loyalty_local`

---

## 🏃 Running the Servers

### Backend (Terminal 1)
```bash
cd Backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Terminal 2)
```bash
cd Frontend
npm run dev
```

---

## 🛠️ Useful Commands

### Database Management

**Reset & reseed everything** (⚠️ destroys all data):
```bash
cd Backend
python seed_all.py --reset --force-update
python seed_sample_data.py
```

**Add more sample data** (keeps existing):
```bash
cd Backend
python seed_sample_data.py
```

**Verify login credentials work:**
```bash
cd Backend
python verify_login.py
```

**Test database connection:**
```bash
cd Backend
python test_db_connection.py
```

### Docker Container Management

**Stop database:**
```bash
docker-compose -f docker-compose.local-db.yml down
```

**Start database:**
```bash
docker-compose -f docker-compose.local-db.yml up -d
```

**View database logs:**
```bash
docker logs -f loyalty_local_db
```

**Check container status:**
```bash
docker ps | grep loyalty
```

### Direct Database Access

**Connect via psql:**
```bash
docker exec -it loyalty_local_db psql -U postgres -d loyalty_local
```

**Run a quick query:**
```bash
docker exec loyalty_local_db psql -U postgres -d loyalty_local -c "SELECT email, role, onboarded FROM users;"
```

---

## 📝 Next Steps

1. ✅ Database is running and seeded
2. ✅ Test accounts are ready
3. ▶️  Start backend: `cd Backend && uvicorn main:app --reload`
4. ▶️  Start frontend: `cd Frontend && npm run dev`
5. 🌐 Open http://localhost:5173
6. 🔐 Login with `smblptest@gmail.com` / `It7742001`

---

## 🐛 Troubleshooting

**Login fails with 401:**
- Run `python verify_login.py` to check user setup
- Check backend logs for detailed error
- Verify database is running: `docker ps | grep loyalty`

**Database connection error:**
- Ensure container is running: `docker-compose -f docker-compose.local-db.yml up -d`
- Check `.env.local` has: `DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5433/loyalty_local`

**Frontend can't connect to backend:**
- Verify backend is running on port 8000
- Check `Frontend/.env` has: `VITE_API_BASE_URL=http://localhost:8000`
- Try clearing browser cache

---

## 📊 Sample API Requests

**Login:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"smblptest@gmail.com","password":"It7742001"}'
```

**Get tenant info:**
```bash
curl http://localhost:8000/api/public/tenant-meta
```

**Health check:**
```bash
curl http://localhost:8000/health/detailed
```

---

**Environment:** Local Development  
**Database:** PostgreSQL 15 (Docker)  
**Last Seeded:** $(date)  
