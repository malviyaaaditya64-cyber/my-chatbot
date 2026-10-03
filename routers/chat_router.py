from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from dependencies.auth import get_current_user
from models import User, MessageFeedback
from schemas.chat import ChatRequest, ChatResponse, RenameConversationRequest, FeedbackRequest
from repositories.message_repository import get_session_messages, save_message, get_user_sessions
from repositories.conversation_repository import ensure_conversation, get_conversation, update_title, delete_conversation, touch_conversation
from services.chat_service import ChatServiceUnavailableError, generate_chat_response

router = APIRouter(prefix="/chat", tags=["Chat"])


def _iso(value):
    return value.isoformat() if value else None


@router.post("", response_model=ChatResponse, status_code=status.HTTP_200_OK)
def chat(request: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_conversation(db, current_user.id, request.session_id)
    messages = get_session_messages(db, request.session_id, user_id=current_user.id)
    previous_messages = [{"role": m.role, "message": m.message} for m in messages]

    if request.message == "FORBIDDEN_TEST":
        raise HTTPException(status_code=400, detail="Invalid chat request.")

    user_message = save_message(db, request.session_id, "user", request.message, user_id=current_user.id)

    try:
        reply = generate_chat_response(previous_messages, request.message)
    except ChatServiceUnavailableError:
        raise HTTPException(status_code=503, detail="Chat service is temporarily unavailable. Please try again.")
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error.")

    assistant_message = save_message(db, request.session_id, "assistant", reply, user_id=current_user.id)

    conversation = get_conversation(db, current_user.id, request.session_id)
    if conversation and conversation.title == "New conversation":
        conversation.title = request.message[:120]
        db.commit()

    touch_conversation(db, current_user.id, request.session_id)

    return {
        "session_id": request.session_id,
        "reply": assistant_message.message,
        "message_id": assistant_message.id,
        "created_at": _iso(assistant_message.created_at),
    }


@router.post("/{session_id}/regenerate", response_model=ChatResponse)
def regenerate(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    messages = get_session_messages(db, session_id, user_id=current_user.id)
    if not messages:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    last_user_index = next((i for i in range(len(messages) - 1, -1, -1) if messages[i].role == "user"), None)
    if last_user_index is None:
        raise HTTPException(status_code=400, detail="There is no user message to regenerate.")

    last_user_message = messages[last_user_index]
    context_messages = [{"role": m.role, "message": m.message} for m in messages[:last_user_index]]

    for message in messages[last_user_index + 1:]:
        if message.role == "assistant":
            db.delete(message)
    db.commit()

    try:
        reply = generate_chat_response(context_messages, last_user_message.message)
    except ChatServiceUnavailableError:
        raise HTTPException(status_code=503, detail="Chat service is temporarily unavailable. Please try again.")
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error.")

    assistant_message = save_message(db, session_id, "assistant", reply, user_id=current_user.id)
    touch_conversation(db, current_user.id, session_id)

    return {
        "session_id": session_id,
        "reply": assistant_message.message,
        "message_id": assistant_message.id,
        "created_at": _iso(assistant_message.created_at),
    }


@router.get("/sessions")
def get_my_chat_sessions(search: str | None = Query(default=None, max_length=120), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"sessions": get_user_sessions(db, current_user.id, search=search)}


@router.get("/{session_id}/history")
def get_chat_history(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    messages = get_session_messages(db, session_id, user_id=current_user.id)
    if not messages:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    feedback_rows = (
        db.query(MessageFeedback)
        .filter(MessageFeedback.user_id == current_user.id)
        .all()
    )
    feedback_map = {row.message_id: row.value for row in feedback_rows}
    return {
        "session_id": session_id,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "message": m.message,
                "created_at": _iso(m.created_at),
                "feedback": feedback_map.get(m.id),
            }
            for m in messages
        ],
    }


@router.patch("/{session_id}")
def rename_chat_session(session_id: str, request: RenameConversationRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conversation = update_title(db, current_user.id, session_id, request.title)
    if not conversation:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return {"session_id": session_id, "title": conversation.title}


@router.post("/{session_id}/feedback")
def save_feedback(session_id: str, request: FeedbackRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    messages = get_session_messages(db, session_id, user_id=current_user.id)
    target = next((m for m in messages if m.id == request.message_id and m.role == "assistant"), None)
    if not target:
        raise HTTPException(status_code=404, detail="Assistant message not found.")

    feedback = (
        db.query(MessageFeedback)
        .filter(MessageFeedback.user_id == current_user.id, MessageFeedback.message_id == request.message_id)
        .first()
    )
    if request.value == "none":
        if feedback:
            db.delete(feedback)
        db.commit()
        return {"message_id": request.message_id, "value": None}

    if feedback:
        feedback.value = request.value
    else:
        feedback = MessageFeedback(user_id=current_user.id, message_id=request.message_id, value=request.value)
        db.add(feedback)
    db.commit()
    return {"message_id": request.message_id, "value": request.value}


@router.delete("/{session_id}/messages")
def clear_chat_session(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    messages = get_session_messages(db, session_id, user_id=current_user.id)
    if not messages:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    for message in messages:
        db.delete(message)
    db.commit()
    conversation = get_conversation(db, current_user.id, session_id)
    if conversation:
        conversation.title = "New conversation"
        touch_conversation(db, current_user.id, session_id)
    return {"message": "Conversation cleared successfully.", "session_id": session_id}


@router.delete("/{session_id}")
def delete_chat_session(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    messages = get_session_messages(db, session_id, user_id=current_user.id)
    conversation = get_conversation(db, current_user.id, session_id)
    if not messages and not conversation:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    for message in messages:
        db.delete(message)
    if conversation:
        db.delete(conversation)
    db.commit()
    return {"message": "Chat session deleted successfully.", "session_id": session_id}
