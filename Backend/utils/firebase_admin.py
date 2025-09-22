# Backend/utils/firebase_admin.py
# Use loaded settings for credentials path
import os
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from config import settings
import logging

logger = logging.getLogger("api")

# Determine which credentials to use (supports .env via settings):
cred_path = settings.google_application_credentials or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if not cred_path:
    # Fallback: inline JSON secret, write once to a temp file
    inline_json = getattr(settings, "firebase_credentials_json", None) or os.getenv("FIREBASE_CREDENTIALS_JSON")
    if inline_json:
        import tempfile
        fd, tmp_path = tempfile.mkstemp(prefix='firebase-', suffix='.json')
        with os.fdopen(fd, 'w') as fh:
            fh.write(inline_json)
        try:
            os.chmod(tmp_path, 0o600)
        except Exception:
            pass
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp_path
        cred_path = tmp_path
        logger.info("Firebase Admin: materialized inline credentials JSON to temp file")
project_id = getattr(settings, "firebase_project_id", None) or os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
if cred_path:
    cred = credentials.Certificate(cred_path)
    logger.info("Firebase Admin: using service account file credentials (path provided)")
else:
    cred = credentials.ApplicationDefault()
    logger.info("Firebase Admin: using Application Default Credentials")

# Only initialize once:
if not firebase_admin._apps:
    try:
        # Pass explicit projectId if available to avoid mismatches when using ADC
        if project_id:
            firebase_admin.initialize_app(cred, {"projectId": project_id})
        else:
            firebase_admin.initialize_app(cred)
        # Log effective project id if we can infer it (safe for ops)
        try:
            from firebase_admin import project_id as _project_id  # type: ignore
        except Exception:
            _project_id = None  # type: ignore
        logger.info("Firebase Admin initialized%s%s",
                    f" for project '{project_id}'" if project_id else "",
                    " (ADC)" if not cred_path else "")
    except Exception as e:
        logger.exception("Firebase Admin initialization failed: %s", e)
        raise

admin_auth = firebase_auth
