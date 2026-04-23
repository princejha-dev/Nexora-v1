"""Authentication — custom bcrypt auth with JWT tokens."""

import uuid
import logging
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import get_settings
from db.supabase import supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()


class AuthRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def _create_token(user_id: str, email: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Validate JWT and return user info."""
    settings = get_settings()
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"user_id": user_id, "email": email}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(req: AuthRequest):
    """Register a new user with bcrypt password hashing."""
    try:
        existing = supabase.table("users").select("id").eq("email", req.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Email already registered")

        user_id = str(uuid.uuid4())
        hashed = _hash_password(req.password)

        supabase.table("users").insert({
            "id": user_id,
            "email": req.email,
            "password_hash": hashed,
        }).execute()

        token = _create_token(user_id, req.email)
        logger.info(f"User registered: {req.email}")
        return AuthResponse(access_token=token, user_id=user_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")


@router.post("/login", response_model=AuthResponse)
async def login(req: AuthRequest):
    """Authenticate user with bcrypt password verification."""
    try:
        result = supabase.table("users").select("id, password_hash").eq("email", req.email).execute()
        if not result.data:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        user = result.data[0]
        if not _verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = _create_token(user["id"], req.email)
        logger.info(f"User logged in: {req.email}")
        return AuthResponse(access_token=token, user_id=user["id"])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {"user_id": user["user_id"], "email": user["email"]}
