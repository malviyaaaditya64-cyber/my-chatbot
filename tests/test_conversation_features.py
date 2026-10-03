from fastapi.testclient import TestClient

from server import app
from database import SessionLocal
from models import User
from repositories.user_repository import create_user
from services.auth_service import hash_password
import routers.chat_router as chat_router


client = TestClient(app)

TEST_USERNAME = "pytest_features_user"
TEST_EMAIL = "pytest_features_user@example.com"
TEST_PASSWORD = "TestPassword123!"


def get_auth_headers():
    db = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(User.username == TEST_USERNAME)
            .first()
        )

        if not user:
            create_user(
                db,
                TEST_USERNAME,
                TEST_EMAIL,
                hash_password(TEST_PASSWORD),
            )
    finally:
        db.close()

    response = client.post(
        "/auth/login",
        json={
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 200

    token = response.json()["access_token"]

    return {
        "Authorization": f"Bearer {token}"
    }


def create_test_conversation(session_id, message="Initial message"):
    headers = get_auth_headers()

    def fake_generate_chat_response(
        previous_messages,
        current_message,
    ):
        return "Test assistant response"

    original = chat_router.generate_chat_response
    chat_router.generate_chat_response = fake_generate_chat_response

    try:
        response = client.post(
            "/chat",
            json={
                "session_id": session_id,
                "message": message,
            },
            headers=headers,
        )
    finally:
        chat_router.generate_chat_response = original

    assert response.status_code == 200

    return headers, response.json()


def test_conversation_title_created_from_first_message():
    session_id = "feature_title_test"

    headers, data = create_test_conversation(
        session_id,
        "My first important question",
    )

    response = client.get(
        "/chat/sessions",
        headers=headers,
    )

    assert response.status_code == 200

    sessions = response.json()["sessions"]

    conversation = next(
        item
        for item in sessions
        if item["session_id"] == session_id
    )

    assert conversation["title"] == "My first important question"


def test_rename_conversation():
    session_id = "feature_rename_test"

    headers, _ = create_test_conversation(
        session_id,
        "Original conversation title",
    )

    response = client.patch(
        f"/chat/{session_id}",
        json={
            "title": "Renamed Conversation",
        },
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Renamed Conversation"

    sessions_response = client.get(
        "/chat/sessions",
        headers=headers,
    )

    sessions = sessions_response.json()["sessions"]

    conversation = next(
        item
        for item in sessions
        if item["session_id"] == session_id
    )

    assert conversation["title"] == "Renamed Conversation"


def test_search_conversations():
    session_id = "feature_search_test"

    headers, _ = create_test_conversation(
        session_id,
        "Python Business Analytics Project",
    )

    response = client.get(
        "/chat/sessions",
        params={
            "search": "Business Analytics",
        },
        headers=headers,
    )

    assert response.status_code == 200

    sessions = response.json()["sessions"]

    assert any(
        item["session_id"] == session_id
        for item in sessions
    )


def test_search_conversations_returns_no_match():
    headers = get_auth_headers()

    response = client.get(
        "/chat/sessions",
        params={
            "search": "THIS_TITLE_SHOULD_NOT_EXIST_12345",
        },
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["sessions"] == []


def test_regenerate_response(monkeypatch):
    session_id = "feature_regenerate_test"

    counter = {
        "value": 0
    }

    def fake_generate_chat_response(
        previous_messages,
        current_message,
    ):
        counter["value"] += 1
        return f"Generated response {counter['value']}"

    monkeypatch.setattr(
        chat_router,
        "generate_chat_response",
        fake_generate_chat_response,
    )

    headers = get_auth_headers()

    first_response = client.post(
        "/chat",
        json={
            "session_id": session_id,
            "message": "Regenerate this answer",
        },
        headers=headers,
    )

    assert first_response.status_code == 200
    assert first_response.json()["reply"] == "Generated response 1"

    regenerate_response = client.post(
        f"/chat/{session_id}/regenerate",
        headers=headers,
    )

    assert regenerate_response.status_code == 200
    assert regenerate_response.json()["reply"] == "Generated response 2"

    history_response = client.get(
        f"/chat/{session_id}/history",
        headers=headers,
    )

    assert history_response.status_code == 200

    messages = history_response.json()["messages"]

    assistant_messages = [
        message
        for message in messages
        if message["role"] == "assistant"
    ]

    assert len(assistant_messages) == 1
    assert assistant_messages[0]["message"] == "Generated response 2"


def test_feedback_up_and_down():
    session_id = "feature_feedback_test"

    headers, data = create_test_conversation(
        session_id,
        "Feedback test message",
    )

    message_id = data["message_id"]

    up_response = client.post(
        f"/chat/{session_id}/feedback",
        json={
            "message_id": message_id,
            "value": "up",
        },
        headers=headers,
    )

    assert up_response.status_code == 200
    assert up_response.json()["value"] == "up"

    down_response = client.post(
        f"/chat/{session_id}/feedback",
        json={
            "message_id": message_id,
            "value": "down",
        },
        headers=headers,
    )

    assert down_response.status_code == 200
    assert down_response.json()["value"] == "down"

    history_response = client.get(
        f"/chat/{session_id}/history",
        headers=headers,
    )

    messages = history_response.json()["messages"]

    assistant_message = next(
        message
        for message in messages
        if message["id"] == message_id
    )

    assert assistant_message["feedback"] == "down"


def test_feedback_can_be_removed():
    session_id = "feature_feedback_remove_test"

    headers, data = create_test_conversation(
        session_id,
        "Feedback removal test",
    )

    message_id = data["message_id"]

    client.post(
        f"/chat/{session_id}/feedback",
        json={
            "message_id": message_id,
            "value": "up",
        },
        headers=headers,
    )

    response = client.post(
        f"/chat/{session_id}/feedback",
        json={
            "message_id": message_id,
            "value": "none",
        },
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["value"] is None


def test_clear_conversation():
    session_id = "feature_clear_test"

    headers, _ = create_test_conversation(
        session_id,
        "Conversation to clear",
    )

    clear_response = client.delete(
        f"/chat/{session_id}/messages",
        headers=headers,
    )

    assert clear_response.status_code == 200

    sessions_response = client.get(
        "/chat/sessions",
        headers=headers,
    )

    sessions = sessions_response.json()["sessions"]

    conversation = next(
        item
        for item in sessions
        if item["session_id"] == session_id
    )

    assert conversation["title"] == "New conversation"

    history_response = client.get(
        f"/chat/{session_id}/history",
        headers=headers,
    )

    assert history_response.status_code == 404


def test_delete_conversation():
    session_id = "feature_delete_test"

    headers, _ = create_test_conversation(
        session_id,
        "Conversation to delete",
    )

    delete_response = client.delete(
        f"/chat/{session_id}",
        headers=headers,
    )

    assert delete_response.status_code == 200

    sessions_response = client.get(
        "/chat/sessions",
        headers=headers,
    )

    sessions = sessions_response.json()["sessions"]

    assert not any(
        item["session_id"] == session_id
        for item in sessions
    )


def test_user_isolation():
    session_id = "feature_isolation_test"

    headers_user_one, _ = create_test_conversation(
        session_id,
        "Private conversation",
    )

    second_username = "pytest_features_user_two"
    second_email = "pytest_features_user_two@example.com"

    db = SessionLocal()

    try:
        existing_user = (
            db.query(User)
            .filter(User.username == second_username)
            .first()
        )

        if not existing_user:
            create_user(
                db,
                second_username,
                second_email,
                hash_password(TEST_PASSWORD),
            )
    finally:
        db.close()

    login_response = client.post(
        "/auth/login",
        json={
            "username": second_username,
            "password": TEST_PASSWORD,
        },
    )

    assert login_response.status_code == 200

    headers_user_two = {
        "Authorization": (
            f"Bearer {login_response.json()['access_token']}"
        )
    }

    history_response = client.get(
        f"/chat/{session_id}/history",
        headers=headers_user_two,
    )

    assert history_response.status_code == 404

    delete_response = client.delete(
        f"/chat/{session_id}",
        headers=headers_user_two,
    )

    assert delete_response.status_code == 404

    original_history = client.get(
        f"/chat/{session_id}/history",
        headers=headers_user_one,
    )

    assert original_history.status_code == 200


def test_protected_chat_requires_authentication():
    response = client.post(
        "/chat",
        json={
            "session_id": "protected_test",
            "message": "Hello",
        },
    )

    assert response.status_code == 401
