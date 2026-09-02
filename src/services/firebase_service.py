"""Firebase Admin SDK service for token verification and user management."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING

from config.settings import settings

if TYPE_CHECKING:
    import firebase_admin
    from firebase_admin import credentials

logger = logging.getLogger(__name__)

_app: firebase_admin.App | None = None
_LOCAL_DEV_CRED_PATH = Path("firebase-service-account.json")


def _load_credentials() -> credentials.Certificate:
    """Env-var-first credential loader with a local-dev file fallback.

    Prod/preview MUST provide FIREBASE_SERVICE_ACCOUNT_JSON. The file fallback
    exists solely so local devs can drop a JSON file in the repo root without
    exporting env vars.
    """
    from firebase_admin import credentials

    if settings.firebase_service_account_json:
        info = json.loads(settings.firebase_service_account_json)
        return credentials.Certificate(info)

    if _LOCAL_DEV_CRED_PATH.is_file():
        return credentials.Certificate(str(_LOCAL_DEV_CRED_PATH))

    raise RuntimeError(
        "Firebase credentials not configured. "
        "Set FIREBASE_SERVICE_ACCOUNT_JSON env var (prod/preview) or place "
        "firebase-service-account.json in repo root (local dev)."
    )


def _init_firebase() -> None:
    """Initialize the Firebase Admin SDK (once)."""
    global _app
    if _app is not None:
        return
    import firebase_admin

    _app = firebase_admin.initialize_app(_load_credentials())


def verify_firebase_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token and return decoded claims.

    Returns dict with keys like 'uid', 'email', 'email_verified',
    'phone_number', 'name', 'picture', 'firebase', etc.
    Raises firebase_admin.auth.InvalidIdTokenError on failure.
    """
    from firebase_admin import auth as firebase_auth

    _init_firebase()
    return firebase_auth.verify_id_token(id_token)


def create_firebase_user(email: str) -> str:
    """Create a Firebase user with the given email. Returns the Firebase UID."""
    from firebase_admin import auth as firebase_auth

    _init_firebase()
    user = firebase_auth.create_user(email=email)
    return user.uid


def create_custom_token(uid: str) -> str:
    """Create a custom token for the given Firebase UID so the client can sign in."""
    from firebase_admin import auth as firebase_auth

    _init_firebase()
    return firebase_auth.create_custom_token(uid).decode("utf-8")


def delete_firebase_user_by_uid(uid: str) -> bool:
    """Delete a user from Firebase Authentication by their Firebase UID."""
    from firebase_admin import auth as firebase_auth
    from firebase_admin.exceptions import FirebaseError

    _init_firebase()
    try:
        firebase_auth.delete_user(uid)
        logger.info("Deleted Firebase user uid=%s", uid)
        return True
    except firebase_auth.UserNotFoundError:
        logger.info("No Firebase user found for uid=%s, nothing to delete", uid)
        return False
    except FirebaseError:
        logger.warning("Failed to delete Firebase user uid=%s", uid, exc_info=True)
        return False


def delete_firebase_user_by_email(email: str) -> bool:
    """Delete a user from Firebase Authentication by email (lookup then delete)."""
    from firebase_admin import auth as firebase_auth
    from firebase_admin.exceptions import FirebaseError

    _init_firebase()
    try:
        fb_user = firebase_auth.get_user_by_email(email)
        firebase_auth.delete_user(fb_user.uid)
        logger.info("Deleted Firebase user email=%s uid=%s", email, fb_user.uid)
        return True
    except firebase_auth.UserNotFoundError:
        logger.info("No Firebase user found for email=%s, nothing to delete", email)
        return False
    except FirebaseError:
        logger.warning("Failed to delete Firebase user email=%s", email, exc_info=True)
        return False
