import logging
from fastapi import APIRouter, Cookie, HTTPException
from backend.db.database import get_connection, reset_all_data
from backend.services.state_manager import state_manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/admin/reset")
async def reset_db(sid: str | None = Cookie(default=None, alias="session_id")):
    if not sid:
        raise HTTPException(status_code=401, detail="セッションがありません")

    conn = get_connection()
    try:
        reset_all_data(conn)
    finally:
        conn.close()

    state_manager.clear_all()
    logger.info("DB reset executed manually by session %s", sid[:8] if sid else "?")
    return {"status": "reset complete"}
