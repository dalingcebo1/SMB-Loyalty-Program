from config import settings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.core.plugin_manager import PluginManager

# Initialize FastAPI
app = FastAPI(
    title="SMB Loyalty Program",
    version="0.1",
    openapi_url="/api/openapi.json",
)

# Validation Error Handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"validation_errors": exc.errors()}),
    )

    # CORS
origins = settings.allowed_origins.split(",") if settings.allowed_origins else []
allowed = [o.strip() for o in origins if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Plugin registration
plugin_manager = PluginManager(app)
plugin_manager.register_models()
plugin_manager.register_routes()
