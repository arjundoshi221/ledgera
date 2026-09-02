"""Admin-specific FastAPI dependencies"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.api.deps import get_user_id
from src.data.database import get_session
from src.data.models import UserModel
from src.data.repositories import UserRepository


def require_admin(
    user_id: str = Depends(get_user_id),
    session: Session = Depends(get_session),
) -> UserModel:
    """
    FastAPI dependency that verifies the current user is an admin.
    Returns the UserModel if admin, raises 403 otherwise.
    """
    user_repo = UserRepository(session)
    user = user_repo.read(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    if user.is_disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    return user
