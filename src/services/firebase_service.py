"""Firebase Admin SDK service for token verification."""

import os
import json
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

_app = None


def _init_firebase():
    """Initialize the Firebase Admin SDK (once)."""
    global _app
    if _app is not None:
        return

    cred_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "firebase-service-account.json")
    if os.path.isfile(cred_path):
        cred = credentials.Certificate(cred_path)
    else:
        cred = credentials.Certificate(json.loads(cred_path))

    _app = firebase_admin.initialize_app(cred)


def verify_firebase_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token and return decoded claims.

    Returns dict with keys like 'uid', 'email', 'email_verified',
    'phone_number', 'name', 'picture', 'firebase', etc.
    Raises firebase_admin.auth.InvalidIdTokenError on failure.
    """
    _init_firebase()
    return firebase_auth.verify_id_token(id_token)
