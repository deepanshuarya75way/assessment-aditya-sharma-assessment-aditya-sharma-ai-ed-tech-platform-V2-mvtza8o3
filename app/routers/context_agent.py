from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from OAuth2 import OAuth2
from pathlib import Path
from uuid import uuid4
from datetime import datetime
from core.schemas import ChatRequest
from dotenv import load_dotenv
from fastapi.concurrency import run_in_threadpool
from core.chat_history_db import chat_sessions, messages
from app.agents.context_agent.graph import agent
from langchain_community.document_loaders import CSVLoader
load_dotenv()

from fastapi import Form
from app.load_documents.text_splitting import text_splitter
from ..retriever.retriever import create_retriever, get_retriever
from docling.document_converter import DocumentConverter
from langchain_core.documents import Document
from langchain_community.document_loaders import PyMuPDFLoader

try:
    converter = DocumentConverter()
except Exception as e:
    converter = None
    print(f"Failed to initialize DocumentConverter: {e}")

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "load_documents" / "uploads"

router = APIRouter(
    prefix="/rag-agent",
    tags=["/"],
)



def validate_file_type(filename: str):
    ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}

    ext = Path(filename).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file format")



def process_document(file_path_str: str, current_user: int, filename: str):

    validate_file_type(filename)
    ext = Path(file_path_str).suffix.lower()

    markdown = ""

    if ext == '.csv':
        loader = CSVLoader(file_path_str)

        rows = loader.load()

        ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}

        for i, row in enumerate(rows):
            words = row.page_content.split()

            found_paths = []
            for word in words:

                clean_word = word.strip('\'",. ')

                if clean_word.lower().endswith(tuple('pdf','docx', 'txt', 'md')):
                    found_paths.append(clean_word)

            
            for path in found_paths:
                if path == '.pdf':

                    loader = PyMuPDFLoader(file_path_str)
                    docs = loader.load()
                    markdown = "\n\n".join([d.page_content for d in docs])

                else:
                    if not converter:
                        raise RuntimeError("DocumentConverter is not initialized")
        
                    result = converter.convert(path)
                    markdown = result.document.export_to_markdown()


    
    if ext == ".pdf":
        loader = PyMuPDFLoader(file_path_str)
        docs = loader.load()
        markdown = "\n\n".join([d.page_content for d in docs])
    else:
        if not converter:
            raise RuntimeError("DocumentConverter is not initialized")
        
        result = converter.convert(file_path_str)
        markdown = result.document.export_to_markdown()

    if not markdown.strip():
        raise ValueError("Uploaded document did not contain readable text")

    doc = Document(
        page_content=markdown,
        metadata={
            "id": current_user,
            "source": filename,
            "title": filename
        }
    )

    chunks = text_splitter.split_documents([doc])

    if not chunks:
        raise ValueError("No text chunks were created from this document")

    # create_retriever(chunks, current_user)

    return chunks


@router.post("/upload")
async def upload(
    files: list[UploadFile] = File(...),
    duplicate_policy: str = Form("skip"),
    current_user: int = Depends(OAuth2.get_current_user)):

    if not files:
        raise HTTPException(status_code = 400, detail = "No files")

    UPLOAD_DIR.mkdir(parents = True, exist_ok= True)

    results = []
    all_chunks = []
    total_chunks = 0

    files_names = set()

    for file in files:
        file_path = None
        try:
            if not file.filename:
                raise ValueError("Invalid name")

            files_names.add(file.filename)

            file_path = (
                UPLOAD_DIR/f"{uuid4()}{Path(file.filename).suffix.lower()}"
            )

            with open(file_path, "wb") as f:
                while chunk:= await file.read(1024*1024):
                    f.write(chunk)

            chunks = await run_in_threadpool(
                process_document, str(file_path), current_user, file.filename
            )
            if not chunks: raise ValueError(
                "no chunks"
            )

            all_chunks.extend(chunks)
            total_chunks += len(chunks)

            results.append({
                "filename": file.filename,
                "status": "success",
                "chunks": len(chunks)
            })

        except ValueError as e:
            results.append({
                "filename": file.filename,
                "status":"failed",
                "error": str(e)
            })

        finally:
            if file_path and file_path.exists():
                file_path.unlink()

    print("registering retreiever for id: ", id)
    create_retriever(all_chunks, id=int(current_user))
    

    return {
        "message": "Upload success",
        "total_files": len(files),
        "results": results,
        "chunks": total_chunks,

    }









@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: int = Depends(OAuth2.get_current_user)
):
    

    if request.session_id is None:

        session_id = str(uuid4())

        chat_sessions.insert_one({
            "_id": session_id,
            "user_id": str(current_user),
            "title": request.user_query[:30],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })

    else:
        session_id = request.session_id


    messages.insert_one({
        "_id": str(uuid4()),
        "session_id": session_id,
        "role": "user",
        "content": request.user_query,
        "created_at": datetime.now()
    })


    config = {
        "configurable": {
            "thread_id": session_id
        }
    }

    ini = {
        "id": current_user,
        "user_query": request.user_query,
        "use_strictly_retriever": request.use_strictly_retriever,
        "docs_available": request.docs_available,
    }

    result = await run_in_threadpool(
        agent.invoke,
        ini,
        config=config
    )

    assistant_response = (
        result.get("final_answer")
        or (result.get("chat_history")[-1].content if result.get("chat_history") else None)
        or result.get("rewrite_query")
        or "I apologize, but no answer could be compiled for your request."
    )
    result["final_answer"] = assistant_response


    messages.insert_one({
        "_id": str(uuid4()),
        "session_id": session_id,
        "role": "assistant",
        "content": assistant_response,
        "created_at": datetime.utcnow()
    })

    # Update chat activity timestamp
    chat_sessions.update_one(
        {"_id": session_id},
        {
            "$set": {
                "updated_at": datetime.utcnow()
            }
        }
    )

    return {
        "session_id": session_id,
        "result": result
    }


@router.get("/sessions")
async def get_sessions(
    current_user: int = Depends(OAuth2.get_current_user)
):
    sessions = list(
        chat_sessions.find(
            {"user_id": str(current_user)}
        ).sort("updated_at", -1)
    )

    return sessions


@router.get("/messages/{session_id}")
async def get_messages(
    session_id: str,
    current_user: int = Depends(OAuth2.get_current_user)
):
    session = chat_sessions.find_one({
        "_id": session_id,
        "user_id": str(current_user)
    })

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Chat session not found"
        )

    history = list(
        messages.find(
            {"session_id": session_id}
        ).sort("created_at", 1)
    )

    return history