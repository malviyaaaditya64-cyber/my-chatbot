from database import SessionLocal
from repositories.message_repository import (
    get_session_messages,
    save_message
)


def test_save_and_get_message():

    db = SessionLocal()

    try:
        session_id = "pytest_repository_test"

        save_message(
            db,
            session_id,
            "user",
            "Hello from pytest"
        )

        messages = get_session_messages(
            db,
            session_id
        )

        assert len(messages) >= 1
        assert messages[-1].role == "user"
        assert messages[-1].message == "Hello from pytest"

    finally:
        db.close()
