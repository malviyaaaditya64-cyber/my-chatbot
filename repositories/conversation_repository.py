from datetime import datetime, timezone

from sqlalchemy.orm import Session

from models import Conversation


def get_conversation(db: Session, user_id: int, session_id: str) -> Conversation | None:
    return (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id, Conversation.session_id == session_id)
        .first()
    )


def ensure_conversation(db: Session, user_id: int, session_id: str, title: str = "New conversation") -> Conversation:
    conversation = get_conversation(db, user_id, session_id)
    if conversation:
        return conversation

    now = datetime.now(timezone.utc)
    conversation = Conversation(
        user_id=user_id,
        session_id=session_id,
        title=title[:120] or "New conversation",
        created_at=now,
        updated_at=now,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def touch_conversation(db: Session, user_id: int, session_id: str) -> None:
    conversation = get_conversation(db, user_id, session_id)
    if conversation:
        conversation.updated_at = datetime.now(timezone.utc)
        db.commit()


def update_title(db: Session, user_id: int, session_id: str, title: str) -> Conversation | None:
    conversation = get_conversation(db, user_id, session_id)
    if not conversation:
        return None
    conversation.title = title.strip()[:120]
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(conversation)
    return conversation


def delete_conversation(db: Session, user_id: int, session_id: str) -> bool:
    conversation = get_conversation(db, user_id, session_id)
    if not conversation:
        return False
    db.delete(conversation)
    db.commit()
    return True
