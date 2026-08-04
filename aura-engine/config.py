import os
from dotenv import load_dotenv

load_dotenv()

AUTH_PASSWORD = os.getenv("AUTH_PASSWORD", "Jarvis99!")
JWT_SECRET = os.getenv("JWT_SECRET", "aura-super-secret-key-2024")
IG_USERNAME = os.getenv("IG_USERNAME", "")
IG_PASSWORD = os.getenv("IG_PASSWORD", "")
IG_SESSIONID = os.getenv("IG_SESSIONID", "")
IG_COOKIES_B64 = os.getenv("AURA_IG_COOKIES_B64", "")
FB_COOKIES_B64 = os.getenv("FB_COOKIES_B64", "")
FB_EMAIL = os.getenv("FB_EMAIL", "")
FB_PASSWORD = os.getenv("FB_PASSWORD", "")
META_PAGE_TOKEN = os.getenv("META_PAGE_TOKEN", "")
FB_PAGE_ID = os.getenv("FB_PAGE_ID", "1271692609354364")
BD_WS_ENDPOINT = os.getenv("BD_WS_ENDPOINT", "")
AI_MODEL = os.getenv("AI_MODEL", "google/gemma-4-26b-a4b-it:free")
AI_FALLBACK_MODEL = os.getenv("AI_FALLBACK_MODEL", "poolside/laguna-xs-2.1:free")
AI_API_URL = os.getenv("AI_API_URL", "https://openrouter.ai/api/v1/chat/completions")
AI_API_KEY = os.getenv("AI_API_KEY", "")
OR_KEY = os.getenv("OR_KEY", AI_API_KEY)
RAILWAY_API_TOKEN = os.getenv("RAILWAY_API_TOKEN", "")
RAILWAY_PROJECT_ID = os.getenv("RAILWAY_PROJECT_ID", "")
RAILWAY_ENV_ID = os.getenv("RAILWAY_ENV_ID", "")
DB_PATH = os.getenv("DB_PATH", "/tmp/aura.db")
APP_PORT = int(os.getenv("PORT", "8000"))
AUTO_REPLY_ENABLED = os.getenv("AUTO_REPLY_ENABLED", "true").lower() in ("true", "1", "yes")
IG_SESSION_FILE = "/tmp/ig_session.pkl"
