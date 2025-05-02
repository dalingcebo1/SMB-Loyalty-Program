# Backend/utils/firebase_admin.py
import os
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

# Determine which credentials to use:
if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
    cred = credentials.Certificate(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
else:
    cred = credentials.ApplicationDefault()

# Only initialize once:
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

admin_auth = firebase_auth
