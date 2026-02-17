"""Authentication service — JWT, password hashing, signup/login"""

from datetime import datetime, timedelta
from typing import Optional, Tuple
from uuid import UUID
import hashlib
import hmac

from jwt import encode, decode, ExpiredSignatureError, InvalidTokenError
from passlib.context import CryptContext

# Password hashing
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


class AuthService:
    """Auth service for signup, login, JWT management"""

    def __init__(self, secret_key: str, algorithm: str = "HS256", token_expiry_hours: int = 24):
        """
        Initialize auth service.
        
        Args:
            secret_key: Secret for JWT signing (use environment variable in production)
            algorithm: JWT algorithm (default HS256)
            token_expiry_hours: Token expiry time (default 24h)
        """
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.token_expiry = timedelta(hours=token_expiry_hours)

    def hash_password(self, password: str) -> str:
        """Hash a password using Argon2"""
        return pwd_context.hash(password)

    def verify_password(self, plain: str, hashed: str) -> bool:
        """Verify plain text password against hash"""
        return pwd_context.verify(plain, hashed)

    def create_access_token(self, user_id: UUID, workspace_id: UUID) -> str:
        """
        Create JWT token.
        
        Args:
            user_id: User UUID
            workspace_id: Workspace UUID
            
        Returns:
            JWT token as string
        """
        payload = {
            "sub": str(user_id),
            "workspace_id": str(workspace_id),
            "exp": datetime.utcnow() + self.token_expiry,
            "iat": datetime.utcnow()
        }
        token = encode(payload, self.secret_key, algorithm=self.algorithm)
        return token

    def decode_access_token(self, token: str) -> Optional[Tuple[UUID, UUID]]:
        """
        Decode and validate JWT token.
        
        Args:
            token: JWT token string
            
        Returns:
            (user_id, workspace_id) or None if invalid
        """
        try:
            payload = decode(token, self.secret_key, algorithms=[self.algorithm])
            user_id = UUID(payload.get("sub"))
            workspace_id = UUID(payload.get("workspace_id"))
            return user_id, workspace_id
        except (ExpiredSignatureError, InvalidTokenError, ValueError, TypeError):
            return None

    def compute_import_hash(self, payee: str, amount: str, date: str) -> str:
        """
        Compute SHA-256 hash for transaction deduplication.
        
        Args:
            payee: Transaction payee
            amount: Amount as string (e.g., "5000")
            date: Date as string (e.g., "2026-01-15")
            
        Returns:
            Hex SHA-256 hash
        """
        msg = f"{payee}|{amount}|{date}"
        return hashlib.sha256(msg.encode()).hexdigest()
