import os
import warnings
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import (
    auth,
    context_agent,
    notebook_agent,
    research_agent,
    profile
)

from core.database import engine
from core.models import user_model

with warnings.catch_warnings():
    warnings.filterwarnings(
        "ignore",
        message=".*not known to support structured output.*"
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Asynchronously create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(user_model.Base.metadata.create_all)
    yield

app = FastAPI(
    title="EduSphere AI",
    description="Ed-Tech platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
frontend_url = os.getenv("FRONTEND_URL")

allowed_origins = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "null"  # Supports local file:// protocol development
]

if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(context_agent.router)
app.include_router(notebook_agent.router)
app.include_router(research_agent.router)
app.include_router(profile.router)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "EduSphere AI API"
    }

from fastapi.responses import FileResponse

@app.get("/favicon.png", include_in_schema=False)
async def favicon():
    return FileResponse("favicon.png")

@app.get("/favicon.ico", include_in_schema=False)
async def favicon_ico():
    return FileResponse("favicon.png")

# Mount frontend static files
app.mount("/", StaticFiles(directory="frontend_ed_tech", html=True), name="frontend")