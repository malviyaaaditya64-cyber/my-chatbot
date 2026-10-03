from sqlalchemy.orm import Session

from models import Message


def get_session_messages(db: Session, session_id: str, user_id=None) -> list[Message]:
    query = db.query(Message).filter(Message.session_id == session_id)
    if user_id is not None:
        query = query.filter(Message.user_id == user_id)
    return query.order_by(Message.created_at.asc(), Message.id.asc()).all()


def save_message(db: Session, session_id: str, role: str, message: str, user_id=None) -> Message:
    new_message = Message(
        session_id=session_id,
        role=role,
        message=message,
        user_id=user_id,
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    return new_message


def get_user_sessions(db: Session, user_id: int, search: str | None = None) -> list[dict]:
    from models import Conversation

    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )

    known = {conversation.session_id for conversation in conversations}
    legacy_messages = (
        db.query(Message)
        .filter(Message.user_id == user_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
        .all()
    )
    for message in legacy_messages:
        if message.session_id in known:
            continue
        title = message.message[:120] if message.role == "user" else "New conversation"
        from datetime import datetime, timezone
        conversation = Conversation(
            user_id=user_id,
            session_id=message.session_id,
            title=title or "New conversation",
            created_at=message.created_at,
            updated_at=message.created_at or datetime.now(timezone.utc),
        )
        db.add(conversation)
        conversations.append(conversation)
        known.add(message.session_id)
    if legacy_messages:
        db.commit()

    conversations.sort(key=lambda item: item.updated_at, reverse=True)
    result = []
    for conversation in conversations:
        if search and search.lower() not in conversation.title.lower():
            continue
        result.append({
            "session_id": conversation.session_id,
            "title": conversation.title,
            "created_at": conversation.created_at,
            "updated_at": conversation.updated_at,
        })
    return result
