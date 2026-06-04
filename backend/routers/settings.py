from typing import Optional
from fastapi import APIRouter, Cookie, HTTPException
from pydantic import BaseModel, Field
from backend.db.session_repository import SessionRepository
from backend.services.state_manager import state_manager

router = APIRouter()

TIME_RE = r"^([01]\d|2[0-3]):[0-5]\d$"


class SettingsUpdate(BaseModel):
    debounce_sec: Optional[int] = Field(None, ge=1, le=10)
    wait_sec: Optional[int] = Field(None, ge=0, le=3600)
    target_lux: Optional[int] = Field(None, ge=0, le=1000)
    power_watt: Optional[float] = Field(None, gt=0, le=10000)
    blackout_from: Optional[str] = Field(None, pattern=TIME_RE)
    blackout_to: Optional[str] = Field(None, pattern=TIME_RE)


def _require_session(sid: str | None) -> SessionRepository:
    if not sid:
        raise HTTPException(status_code=401, detail="セッションがありません")
    repo = SessionRepository(sid)
    if not repo.session_exists():
        raise HTTPException(status_code=404, detail="セッションが見つかりません")
    return repo


@router.get("/settings")
async def get_settings(sid: str | None = Cookie(default=None, alias="session_id")):
    repo = _require_session(sid)
    return repo.get_settings()


@router.put("/settings")
async def update_settings(
    body: SettingsUpdate,
    sid: str | None = Cookie(default=None, alias="session_id"),
):
    repo = _require_session(sid)
    updates = body.model_dump(exclude_none=True)
    repo.update_settings(**updates)
    new_settings = repo.get_settings()

    state = state_manager.get(sid)
    if state:
        state.update_settings(new_settings)

    return new_settings
