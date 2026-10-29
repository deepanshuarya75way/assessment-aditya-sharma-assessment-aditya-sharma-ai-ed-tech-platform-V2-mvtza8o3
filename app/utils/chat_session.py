import uuid
from datetime import datetime
from core.chat_history_db import chat_sessions, messages

def create_session(user_id: str, title: str = "New Chat"):
    session_id = str(uuid.uuid4())

    chat_sessions.insert_one({
        "_id": session_id,
        "user_id": user_id,
        "title": title,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })

    return session_id


def save_message(session_id: str, role: str, content: str):
    messages.insert_one({
        "_id": str(uuid.uuid4()),
        "session_id": session_id,
        "role": role,
        "content": content,
        "created_at": datetime.utcnow()
    })


def get_chat_history(session_id: str):
    return list(
        messages.find(
            {"session_id": session_id}
        ).sort("created_at", 1)
    )