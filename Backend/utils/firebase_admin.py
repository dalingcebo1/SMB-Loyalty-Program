# Backend/utils/firebase_admin.py
# Use loaded settings for credentials path
import os
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from config import settings

# Determine which credentials to use (supports .env via settings):
cred_path = settings.google_application_credentials or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if cred_path:
    cred = credentials.Certificate(cred_path)
else:
    cred = credentials.ApplicationDefault()

# Only initialize once:
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

admin_auth = firebase_auth
