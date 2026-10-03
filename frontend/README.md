MyChatbot

A full-stack AI chatbot application built with React, Vite, FastAPI,
SQLAlchemy, SQLite, JWT authentication, and Google Gemini.

MyChatbot provides authenticated, persistent conversations with
conversation management, AI response regeneration, message feedback,
search, error handling, and a responsive web interface.

✨ Features

Authentication

User registration and login

JWT-based authentication

Protected chat endpoints

User-specific conversation and message history

Logout support

AI Chat

Google Gemini-powered responses

Persistent conversation history

Session-based conversations

Typing/loading indicator

Response regeneration

Copy AI responses

Conversation Management

Create a new conversation

Automatically generated conversation titles

Search conversations

Rename conversations

Clear conversation messages

Delete conversations

Conversation history persists after refresh and re-login

Message Feedback

👍 Positive feedback

👎 Negative feedback

Remove existing feedback

UX & Reliability

Responsive React interface

Mobile sidebar

Message timestamps

Automatic scroll to latest message

Friendly error UI

Retry after temporary backend/API failure

Production frontend build verified successfully

🏗️ Tech Stack

Layer               Technology

Frontend            React
Build Tool          Vite
Icons               Lucide React
Backend             FastAPI
ORM                 SQLAlchemy
Database            SQLite
AI                  Google Gemini
Authentication      JWT
Password Security   bcrypt
API Validation      Pydantic
Testing             pytest
Runtime             Python + Node.js

📁 Project Structure

my-chatbot/
│
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.*
│   └── ...
│
├── repositories/
│   ├── conversation_repository.py
│   └── message_repository.py
│
├── routers/
│   ├── auth_router.py
│   └── chat_router.py
│
├── schemas/
│   └── chat.py
│
├── services/
│   └── chat_service.py
│
├── tests/
│   ├── test_api.py
│   ├── test_conversation_features.py
│   └── ...
│
├── config.py
├── database.py
├── models.py
├── server.py
├── chatbot.db
└── ...

🔐 Authentication

The application uses JWT access tokens for authenticated API requests.

User passwords are stored as password hashes rather than plain-text
passwords.

Protected resources are scoped to the authenticated user, so one user's
conversations and messages are not exposed to another user.

💬 Conversation Architecture

A conversation is identified by a session_id.

The backend maintains:

User

Conversation

Message

MessageFeedback

A conversation belongs to a user, while messages are associated with
both the session and authenticated user.

The application also supports legacy message records through session
discovery/backfilling logic.

🔌 API Endpoints

Authentication

POST /auth/register
POST /auth/login
GET  /auth/me

Chat

POST   /chat
GET    /chat/sessions
GET    /chat/{session_id}/history
PATCH  /chat/{session_id}
POST   /chat/{session_id}/regenerate
POST   /chat/{session_id}/feedback
DELETE /chat/{session_id}/messages
DELETE /chat/{session_id}

Health / Root

GET /

The root endpoint returns:

{
  "message": "My chatbot API is running!"
}

⚙️ Environment Variables

Create a .env file in the project root.

Example:

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.1-flash-lite

JWT_SECRET_KEY=your_long_random_secret
ACCESS_TOKEN_EXPIRE_MINUTES=30

FRONTEND_ORIGIN=http://localhost:5173

Important

Do not commit .env or API keys to Git.

Use a strong, private value for JWT_SECRET_KEY.

🚀 Local Setup

1. Clone the repository

git clone <your-repository-url>
cd my-chatbot

2. Create and activate the Python virtual environment

python -m venv .venv
.\.venv\Scripts\Activate.ps1

3. Install backend dependencies

If a backend requirements file is present in the repository:

pip install -r requirements.txt

4. Configure environment variables

Create .env in the project root and add the required variables shown
above.

5. Start the FastAPI backend

uvicorn server:app --reload

Backend:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

🎨 Frontend Setup

Open another PowerShell window:

cd "my-chatbot\frontend"
npm install
npm run dev

Frontend:

http://localhost:5173/

🧪 Testing

The backend currently has a test suite covering authentication, chat
behavior, conversation management, feedback, regeneration,
clearing/deletion, protected endpoints, and user isolation.

Run all tests:

cd "C:\Users\HITS\Desktop\my-chatbot"
pytest -q

Current verified result:

25 passed

Two non-blocking deprecation warnings were present during the test run.

📦 Production Frontend Build

To create a production frontend build:

cd "C:\Users\HITS\Desktop\my-chatbot\frontend"
npm run build

The production build has been successfully verified.

🛡️ Security Considerations

The current application includes:

JWT authentication

Password hashing

Protected API routes

User-scoped conversations

User-scoped messages

Input validation through Pydantic

Environment-based secret configuration

CORS configuration

No plain-text password storage

Before public production deployment, additional hardening should be
considered, including:

HTTPS

Production secret management

Rate limiting

Production database strategy

Database backups

Monitoring and alerting

More comprehensive security testing

🧭 Current Project Status

The core application is complete and working locally.

Completed

Authentication

AI chat

Persistent chat history

Conversation management

Search

Rename

Delete

Clear conversation

Regenerate response

Message feedback

Error handling

Retry flow

Responsive frontend

Backend test suite

Production frontend build

Next Phase

The next development phase is production deployment and hardening.

Planned deployment work includes:

Backend deployment

Frontend deployment

Production environment variables

CORS configuration for the deployed frontend

Production database strategy

Live end-to-end testing

Production security review

🔮 Future Enhancements

Potential future features:

Streaming AI responses

File and document upload

Voice input/output

Markdown and code rendering enhancements

Advanced AI memory

Admin dashboard

Usage analytics

Dark mode

Conversation export

Production monitoring

These are future enhancements and are not required for the current core
application.

👨‍💻 Author

Aaditya Malviya

MBA --- Business Analytics & AI

📄 License

Add the project's chosen license before publishing the repository
publicly.