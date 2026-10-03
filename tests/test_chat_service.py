from services import chat_service


def test_generate_chat_response(monkeypatch):

    class FakeResponse:
        text = "Hello Aaditya!"

    class FakeModels:
        def generate_content(self, model, contents):
            assert model == "gemini-3.1-flash-lite"
            assert "user: My name is Aaditya." in contents
            assert "model: Nice to meet you." in contents
            assert "user: How are you?" in contents

            return FakeResponse()

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(
        chat_service,
        "client",
        FakeClient()
    )

    previous_messages = [
        {
            "role": "user",
            "message": "My name is Aaditya."
        },
        {
            "role": "model",
            "message": "Nice to meet you."
        }
    ]

    result = chat_service.generate_chat_response(
        previous_messages,
        "How are you?"
    )

    assert result == "Hello Aaditya!"

def test_generate_chat_response_raises_service_unavailable(monkeypatch):

    class FakeModels:
        def generate_content(self, model, contents):
            raise RuntimeError("Gemini failed")

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(
        chat_service,
        "client",
        FakeClient()
    )

    try:
        chat_service.generate_chat_response(
            [],
            "Hello"
        )
        assert False, "Expected ChatServiceUnavailableError"
    except chat_service.ChatServiceUnavailableError as error:
        assert str(error) == "Gemini service unavailable"
