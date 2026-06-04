import os
from dotenv import load_dotenv

load_dotenv()

ENV: str = os.getenv("ENV", "production")
DATABASE_URL: str = os.getenv("DATABASE_URL", "smart_light.db")
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
