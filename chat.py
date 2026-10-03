import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)

chat = client.chats.create(
    model="gemini-3.1-flash-lite",
    config={
        "system_instruction": (
            "You are a helpful Business Analyst tutor. "
            "Explain concepts in simple Hinglish. "
            "Assume the user is a beginner. "
            "Give practical examples whenever useful."
        )
    }
)

print("Chat session created.")
print("Chatbot started!")
print("Type 'exit' to stop the chatbot.")

while True:
    user_message = input("You: ").strip()

    if not user_message:
        print("Bot: Please kuch type karo.")
        continue

    if user_message.lower() == "exit":
        print("Bot: Goodbye!")
        break

    try:
        response = chat.send_message(
            message=user_message
        )

        print("Bot:", response.text)

    except Exception as error:
        print("Bot: Sorry, kuch technical problem aa gayi.")
        print("Error:", error)