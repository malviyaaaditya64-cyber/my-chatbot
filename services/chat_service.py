from google import genai

from config import GEMINI_API_KEY, GEMINI_MODEL


class ChatServiceUnavailableError(Exception):
    pass


client = genai.Client(api_key=GEMINI_API_KEY)


def generate_chat_response(
    previous_messages: list[dict],
    current_message: str
) -> str:

    conversation = []

    for message in previous_messages:
        conversation.append(
            f"{message['role']}: {message['message']}"
        )

    conversation.append(
        f"user: {current_message}"
    )

    prompt = "\n".join(conversation)

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt
        )
    except Exception as error:
        raise ChatServiceUnavailableError(
            "Gemini service unavailable"
        ) from error

    return response.text
