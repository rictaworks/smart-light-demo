from fastapi import APIRouter, Cookie, HTTPException
from backend.db.session_repository import SessionRepository
from backend.services.state_manager import state_manager

router = APIRouter()


@router.get("/energy")
async def get_energy(sid: str | None = Cookie(default=None, alias="session_id")):
    if not sid:
        raise HTTPException(status_code=401, detail="セッションがありません")
    repo = SessionRepository(sid)
    if not repo.session_exists():
        raise HTTPException(status_code=404, detail="セッションが見つかりません")

    state = state_manager.get(sid)
    snapshot = (
        state.get_energy_snapshot()
        if state
        else {"on_minutes": 0, "kwh_used": 0, "kwh_saved": 0}
    )
    logs = repo.get_energy_logs(hours=24)
    return {"current": snapshot, "logs": logs}
