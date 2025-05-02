# Backend/utils/firebase_admin.py
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

cred = credentials.Certificate("firebase-service-account.json")
firebase_app = firebase_admin.initialize_app(cred)
admin_auth = firebase_auth
