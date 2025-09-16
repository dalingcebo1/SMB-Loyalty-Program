from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import EmailStr, Field, Extra
import re

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
    # NOTE: Workaround: env="SECRET_KEY" not being picked up in current pydantic_settings version for this specific name.
    # Using alias ensures population from environment variable SECRET_KEY (populate_by_name enabled implicitly for BaseSettings).
    loyalty_secret: str = Field("dev_loyalty_secret", alias="SECRET_KEY")
    default_tenant: str = "default"
    price_csv_url: Optional[str] = None
    google_application_credentials: Optional[str] = None
    # Optional: Inline JSON for Firebase service account (alternative to mounting a file)
    firebase_credentials_json: Optional[str] = Field(None, env="FIREBASE_CREDENTIALS_JSON")
    # Directory for serving static assets (branding uploads, compiled frontend)
    static_dir: str = Field("static", env="STATIC_DIR")

    # --- Rate limiting / jobs / observability (prod-oriented) ---
    rate_limit_public_meta_capacity: int = Field(60, env="RATE_LIMIT_PUBLIC_META_CAPACITY")
    rate_limit_public_meta_window_seconds: int = Field(60, env="RATE_LIMIT_PUBLIC_META_WINDOW")
    rate_limit_user_tenant_capacity: int = Field(30, env="RATE_LIMIT_USER_TENANT_CAPACITY")
    rate_limit_user_tenant_window_seconds: int = Field(60, env="RATE_LIMIT_USER_TENANT_WINDOW")
    rate_limit_global_capacity: int = Field(120, env="RATE_LIMIT_GLOBAL_CAPACITY")
    rate_limit_global_window_seconds: int = Field(60, env="RATE_LIMIT_GLOBAL_WINDOW")
    enable_rate_limit_overrides: bool = Field(True, env="ENABLE_RATE_LIMIT_OVERRIDES")  # disable in prod to lock config
    enable_rate_limit_penalties: bool = Field(True, env="ENABLE_RATE_LIMIT_PENALTIES")
    enable_job_queue: bool = Field(False, env="ENABLE_JOB_QUEUE")  # in-process queue generally off in prod
    enable_metrics_endpoint: bool = Field(True, env="ENABLE_METRICS")

    # --- Dev / safety feature flags ---
    environment: str = Field("development", env="ENVIRONMENT")  # e.g. development|staging|production
    enable_dev_dangerous: bool = Field(True, env="ENABLE_DEV_DANGEROUS")  # master switch for destructive ops
    enable_dev_jobs: bool = Field(True, env="ENABLE_DEV_JOBS")
    enable_dev_rate_limits: bool = Field(True, env="ENABLE_DEV_RATE_LIMITS")
    enable_dev_audit_view: bool = Field(True, env="ENABLE_DEV_AUDIT_VIEW")

    # Observability external services
    sentry_dsn: Optional[str] = Field(None, env="SENTRY_DSN")
    # Optional Content Security Policy (string). Example minimal default provided for guidance.
    csp_policy: Optional[str] = Field(None, env="CSP_POLICY")

    def dangerous_allowed(self) -> bool:
        """Return True if destructive dev endpoints are permitted in this environment."""
        return self.enable_dev_dangerous and self.environment != "production"

    def _strip_wrapping_quotes(self, value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        v = value.strip()
        # Remove a single layer of matching quotes ("..." or '...') to tolerate mis-quoted secret injection
        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
            v = v[1:-1].strip()
        return v

    def normalise(self):  # intentionally British spelling to avoid conflict
        """Idempotently normalize key settings (strip accidental wrapping quotes, collapse whitespace).

        This is defensive against CI/CD quoting mistakes that produced values like:
            '"postgresql+psycopg2://user:pass@host:5432/db"'
        or SECRET_KEY surrounded by quotes causing strength validation to fail.
        """
        self.database_url = self._strip_wrapping_quotes(self.database_url)
        if self.allowed_origins:
            cleaned = [self._strip_wrapping_quotes(p).strip() for p in self.allowed_origins.split(',') if p.strip()]
            self.allowed_origins = ",".join(dict.fromkeys(cleaned)) if cleaned else None
        # loyalty_secret exposed via alias; normalize
        if hasattr(self, 'loyalty_secret') and isinstance(self.loyalty_secret, str):
            self.loyalty_secret = self._strip_wrapping_quotes(self.loyalty_secret)
        if self.frontend_url:
            self.frontend_url = self._strip_wrapping_quotes(self.frontend_url)
        return self

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = Extra.ignore  # ignore any unrecognized vars

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance.

    Using an accessor with caching allows tests to clear the cache and force
    re-evaluation of environment variables without relying on module reload
    side-effects. In production this behaves like a singleton while avoiding
    import-time evaluation issues if env vars are injected late in the lifecycle.
    """
    s = Settings()
    return s.normalise()

# Backward compatibility: keep a module-level singleton reference for existing imports.
# Prefer calling get_settings() in new code and tests for deterministic refresh semantics.
settings = get_settings()
