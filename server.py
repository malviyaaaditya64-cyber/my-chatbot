import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import FRONTEND_ORIGIN
from database import Base, engine
from routers.chat_router import router as chat_router
from routers.auth_router import router as auth_router

# Creates newly introduced tables without changing existing tables/data.
Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("my-chatbot")

app = FastAPI(title="MyChatbot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(chat_router)
app.include_router(auth_router)


@app.middleware("http")
async def request_logging_middleware(request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    logger.info("%s %s -> %s (%.4fs)", request.method, request.url.path, response.status_code, process_time)
    return response


@app.get("/")
def home():
    return {"message": "My chatbot API is running!"}
