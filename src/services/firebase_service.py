"""Firebase Admin SDK service for token verification and user management."""

import logging
import os
import json
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

logger = logging.getLogger(__name__)

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


def create_firebase_user(email: str) -> str:
    """Create a Firebase user with the given email. Returns the Firebase UID."""
    _init_firebase()
    user = firebase_auth.create_user(email=email)
    return user.uid


def create_custom_token(uid: str) -> str:
    """Create a custom token for the given Firebase UID so the client can sign in."""
    _init_firebase()
    return firebase_auth.create_custom_token(uid).decode("utf-8")


def delete_firebase_user_by_uid(uid: str) -> bool:
    """Delete a user from Firebase Authentication by their Firebase UID."""
    _init_firebase()
    try:
        firebase_auth.delete_user(uid)
        logger.info("Deleted Firebase user uid=%s", uid)
        return True
    except Exception:
        logger.warning("Failed to delete Firebase user uid=%s", uid, exc_info=True)
        return False


def delete_firebase_user_by_email(email: str) -> bool:
    """Delete a user from Firebase Authentication by email (lookup then delete)."""
    _init_firebase()
    try:
        fb_user = firebase_auth.get_user_by_email(email)
        firebase_auth.delete_user(fb_user.uid)
        logger.info("Deleted Firebase user email=%s uid=%s", email, fb_user.uid)
        return True
    except firebase_auth.UserNotFoundError:
        logger.info("No Firebase user found for email=%s, nothing to delete", email)
        return False
    except Exception:
        logger.warning("Failed to delete Firebase user email=%s", email, exc_info=True)
        return False
