import logging

from fastapi.testclient import TestClient

from server import app
from database import Base, engine
from models import User
from repositories.user_repository import create_user
from services.auth_service import hash_password

import routers.chat_router as chat_router


Base.metadata.create_all(bind=engine)

client = TestClient(app)


TEST_USERNAME = "pytest_user_api"
TEST_EMAIL = "pytest_user_api@example.com"
TEST_PASSWORD = "TestPassword123!"


def get_auth_headers():
    response = client.post(
        "/auth/login",
        json={
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD,
        },
    )

    if response.status_code == 401:
        from database import SessionLocal

        db = SessionLocal()

        try:
            existing_user = (
                db.query(User)
                .filter(User.username == TEST_USERNAME)
                .first()
            )

            if not existing_user:
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


def test_chat_endpoint(monkeypatch):

    def fake_generate_chat_response(
        previous_messages,
        current_message,
    ):
        return "Hello from test bot!"

    monkeypatch.setattr(
        chat_router,
        "generate_chat_response",
        fake_generate_chat_response,
    )

    response = client.post(
        "/chat",
        json={
            "session_id": "api_test_2",
            "message": "Hello",
        },
        headers=get_auth_headers(),
    )

    assert response.status_code == 200

    data = response.json()

    assert data["session_id"] == "api_test_2"
    assert data["reply"] == "Hello from test bot!"
    assert "message_id" in data
    assert "created_at" in data


def test_chat_rejects_empty_message():

    response = client.post(
        "/chat",
        json={
            "session_id": "validation_test",
            "message": "",
        },
        headers=get_auth_headers(),
    )

    assert response.status_code == 422


def test_chat_rejects_empty_session_id():

    response = client.post(
        "/chat",
        json={
            "session_id": "",
            "message": "Hello",
        },
        headers=get_auth_headers(),
    )

    assert response.status_code == 422


def test_chat_rejects_missing_message():

    response = client.post(
        "/chat",
        json={
            "session_id": "validation_test",
        },
        headers=get_auth_headers(),
    )

    assert response.status_code == 422


def test_chat_rejects_missing_session_id():

    response = client.post(
        "/chat",
        json={
            "message": "Hello",
        },
        headers=get_auth_headers(),
    )

    assert response.status_code == 422


def test_history_returns_404_for_unknown_session():

    response = client.get(
        "/chat/session_that_does_not_exist_123/history",
        headers=get_auth_headers(),
    )

    assert response.status_code == 404


def test_chat_returns_500_when_chat_service_fails(monkeypatch):

    def fake_generate_chat_response(
        previous_messages,
        current_message,
    ):
        raise RuntimeError("Simulated unexpected error")

    monkeypatch.setattr(
        chat_router,
        "generate_chat_response",
        fake_generate_chat_response,
    )

    response = client.post(
        "/chat",
        json={
            "session_id": "error_test_500",
            "message": "Hello",
        },
        headers=get_auth_headers(),
    )

    assert response.status_code == 500


def test_chat_returns_503_when_chat_service_unavailable(monkeypatch):

    def fake_generate_chat_response(
        previous_messages,
        current_message,
    ):
        raise chat_router.ChatServiceUnavailableError(
            "Gemini service unavailable"
        )

    monkeypatch.setattr(
        chat_router,
        "generate_chat_response",
        fake_generate_chat_response,
    )

    response = client.post(
        "/chat",
        json={
            "session_id": "error_test_503",
            "message": "Hello",
        },
        headers=get_auth_headers(),
    )

    assert response.status_code == 503


def test_chat_rejects_invalid_json():

    response = client.post(
        "/chat",
        content="{invalid json}",
        headers={
            **get_auth_headers(),
            "Content-Type": "application/json",
        },
    )

    assert response.status_code == 422


def test_chat_rejects_forbidden_message():

    response = client.post(
        "/chat",
        json={
            "session_id": "bad_request_test",
            "message": "FORBIDDEN_TEST",
        },
        headers=get_auth_headers(),
    )

    assert response.status_code == 400


def test_request_logging_middleware(caplog):

    with caplog.at_level(logging.INFO, logger="my-chatbot"):
        response = client.get("/")

    assert response.status_code == 200

    log_messages = [
        record.getMessage()
        for record in caplog.records
        if record.name == "my-chatbot"
    ]

    assert any("GET /" in message for message in log_messages)
