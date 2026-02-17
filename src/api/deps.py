"""Shared FastAPI dependencies for auth and workspace scoping"""

from fastapi import Request, HTTPException, status


def get_user_id(request: Request) -> str:
    """Extract user_id from request state (set by auth middleware)"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return user_id


def get_workspace_id(request: Request) -> str:
    """Extract workspace_id from request state (set by auth middleware)"""
    workspace_id = getattr(request.state, "workspace_id", None)
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return workspace_id
