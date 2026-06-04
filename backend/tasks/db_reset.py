import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from backend.db.database import get_connection, reset_all_data
from backend.services.state_manager import state_manager

logger = logging.getLogger(__name__)


async def reset_daily() -> None:
    logger.info("毎日 JST 03:00 DB リセット開始")
    conn = get_connection()
    try:
        reset_all_data(conn)
        state_manager.clear_all()
        logger.info("毎日 JST 03:00 DB リセット完了")
    except Exception as exc:
        logger.error("DB リセット失敗: %s", exc)
        raise
    finally:
        conn.close()


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="Asia/Tokyo")
    scheduler.add_job(
        reset_daily,
        trigger=CronTrigger(hour=3, minute=0, timezone="Asia/Tokyo"),
        id="daily_reset",
        replace_existing=True,
    )
    return scheduler
