import logging
from fastapi import APIRouter, Cookie, HTTPException
from pydantic import BaseModel, Field
from backend.db.session_repository import SessionRepository
from backend.services.state_manager import state_manager

logger = logging.getLogger(__name__)
router = APIRouter()


class ManualControl(BaseModel):
    status: str = Field(..., pattern="^(on|off)$")
    brightness: int = Field(..., ge=0, le=100)


def _get_state(sid: str | None):
    if not sid:
        raise HTTPException(status_code=401, detail="セッションがありません")
    repo = SessionRepository(sid)
    if not repo.session_exists():
        raise HTTPException(status_code=404, detail="セッションが見つかりません")
    state = state_manager.get(sid)
    if not state:
        settings = repo.get_settings()
        light = repo.get_light_state()
        state = state_manager.get_or_create(sid, settings, light)
        state.set_callbacks(
            on_light_change=repo.save_light_state,
            on_energy_log=repo.append_energy_log,
        )
    return state, repo


@router.get("/light")
async def get_light(sid: str | None = Cookie(default=None, alias="session_id")):
    state, _ = _get_state(sid)
    return {
        "light": state.light.to_dict(),
        "sensors": state.sensor.get_states(),
        "energy": state.get_energy_snapshot(),
    }


@router.post("/light/manual")
async def manual_control(
    body: ManualControl,
    sid: str | None = Cookie(default=None, alias="session_id"),
):
    state, _ = _get_state(sid)
    await state.set_manual(body.status, body.brightness)
    return {"light": state.light.to_dict()}


@router.post("/light/auto")
async def auto_mode(sid: str | None = Cookie(default=None, alias="session_id")):
    state, _ = _get_state(sid)
    await state.set_auto()
    return {"light": state.light.to_dict()}
