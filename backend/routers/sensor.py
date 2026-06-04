import logging
from fastapi import APIRouter, Cookie, HTTPException
from pydantic import BaseModel, Field
from backend.db.session_repository import SessionRepository
from backend.services.state_manager import state_manager

logger = logging.getLogger(__name__)
router = APIRouter()


class SensorUpdate(BaseModel):
    sensor_index: int = Field(..., ge=0, le=2)
    detected: bool
    lux: int = Field(..., ge=0, le=1000)


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


@router.post("/sensor")
async def update_sensor(
    body: SensorUpdate,
    sid: str | None = Cookie(default=None, alias="session_id"),
):
    state, repo = _get_state(sid)
    repo.append_sensor_log(body.sensor_index, body.detected, body.lux)
    await state.process_sensor_update(body.sensor_index, body.detected, body.lux)
    return {
        "light": state.light.to_dict(),
        "sensors": state.sensor.get_states(),
    }
