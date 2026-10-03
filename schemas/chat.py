from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=4000)


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    message_id: int
    created_at: str


class RenameConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class FeedbackRequest(BaseModel):
    message_id: int
    value: str = Field(pattern="^(up|down|none)$")
