import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.db.database import init_db
from backend.routers import session, sensor, light, energy, settings, admin
from backend.tasks.db_reset import create_scheduler
from backend.config import FRONTEND_URL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler = create_scheduler()
    scheduler.start()
    logger.info("アプリケーション起動完了")
    yield
    scheduler.shutdown()
    logger.info("アプリケーション停止")


app = FastAPI(
    title="Smart Light Demo API",
    description="スマート照明デモ版 REST API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session.router, prefix="/api", tags=["session"])
app.include_router(sensor.router, prefix="/api", tags=["sensor"])
app.include_router(light.router, prefix="/api", tags=["light"])
app.include_router(energy.router, prefix="/api", tags=["energy"])
app.include_router(settings.router, prefix="/api", tags=["settings"])
app.include_router(admin.router, prefix="/api", tags=["admin"])
