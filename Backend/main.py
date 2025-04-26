# Backend/main.py
import os, sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routes.loyalty import router as loyalty_router

# so that `import routes.loyalty` works
sys.path.append(os.path.dirname(__file__))

app = FastAPI()

# 🔓 DEV-ONLY: completely open CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # allow any origin
    allow_credentials=False,  # must be False if allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# all our endpoints live under /api
app.include_router(loyalty_router, prefix="/api")

# serve a built SPA if present
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
    @app.get("/{full_path:path}")
    def spa_fallback():
        return FileResponse(os.path.join(static_dir, "index.html"))

@app.get("/api/healthz")
def healthz():
    return {"status": "ok"}
