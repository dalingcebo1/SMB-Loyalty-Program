from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import EmailStr, Field, Extra

class Settings(BaseSettings):
    # Map to existing .env names
    jwt_secret: str = Field("dev_jwt_secret", env="JWT_SECRET")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    reset_secret: str = Field("dev_reset_secret", env="RESET_SECRET")
    reset_token_expire_seconds: int = 60 * 30
    sendgrid_api_key: Optional[str] = None
    reset_email_from: EmailStr = "no-reply@example.com"
    frontend_url: str = "http://localhost:5173"

    # Additional configuration
    database_url: str = Field("sqlite:///./dev.db", env="DATABASE_URL")
    allowed_origins: Optional[str] = None  # comma-separated list
    yoco_secret_key: str = Field("dev_yoco_secret", env="YOCO_SECRET_KEY")
    yoco_webhook_secret: str = Field("dev_yoco_webhook_secret", env="YOCO_WEBHOOK_SECRET")
    loyalty_secret: str = Field("dev_loyalty_secret", env="SECRET_KEY")
    default_tenant: str = "default"
    price_csv_url: Optional[str] = None
    google_application_credentials: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = Extra.ignore  # ignore any unrecognized vars

# Instantiate singleton settings
settings = Settings()
