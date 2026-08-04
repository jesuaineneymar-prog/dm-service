import hashlib
import hmac
import jwt
import time
import base64
import json
from config import JWT_SECRET


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_token() -> str:
    payload = {"sub": "jarvis_user", "iat": int(time.time()), "exp": int(time.time()) + 86400}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_token(token: str) -> bool:
    try:
        jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return True
    except:
        return False


def encode_cookies_b64(cookies: list) -> str:
    return base64.b64encode(json.dumps(cookies).encode()).decode()


def decode_cookies_b64(b64: str) -> list:
    try:
        return json.loads(base64.b64decode(b64).decode())
    except:
        return []