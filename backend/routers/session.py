import uuid
import logging
from fastapi import APIRouter, Cookie, Response
from backend.db.session_repository import SessionRepository
from backend.services.state_manager import state_manager

logger = logging.getLogger(__name__)
router = APIRouter()


def _init_state(sid: str, repo: SessionRepository) -> None:
    settings = repo.get_settings()
    light = repo.get_light_state()
    state = state_manager.get_or_create(sid, settings, light)
    state.set_callbacks(
        on_light_change=repo.save_light_state,
        on_energy_log=repo.append_energy_log,
    )


@router.post("/session")
async def create_session(
    response: Response,
    sid: str | None = Cookie(default=None, alias="session_id"),
    hp: str = "",  # ハニーポット：値が入っていたらボット
):
    if hp:
        logger.warning("Honeypot triggered, rejecting request")
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Bad request")

    if sid:
        repo = SessionRepository(sid)
        if repo.session_exists():
            repo.touch_session()
            if not state_manager.get(sid):
                _init_state(sid, repo)
            return {"session_id": sid}

    new_sid = str(uuid.uuid4())
    repo = SessionRepository(new_sid)
    repo.create_session()
    _init_state(new_sid, repo)

    response.set_cookie(
        key="session_id",
        value=new_sid,
        httponly=True,
        samesite="strict",
        max_age=86400,
    )
    logger.info("New session created: %s", new_sid[:8])
    return {"session_id": new_sid}
