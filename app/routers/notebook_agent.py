from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from OAuth2 import OAuth2
from pathlib import Path
from uuid import uuid4
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv

load_dotenv()

from app.agents.notebook_agent.utils import clean_pdf_text
from app.agents.notebook_agent.graph import agent
from docling.document_converter import DocumentConverter

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "load_documents" / "uploads"

router = APIRouter(
    prefix="/notebook-agent",
    tags=["notebook"],
)

def extract_and_window_pages(file_path_str: str, window_size: int = 4, overlap: int = 1):
    ext = Path(file_path_str).suffix.lower()
    pages = []
    
    supported_extensions = [".pdf", ".txt", ".md", ".markdown", ".doc", ".docx"]
    
    try:
        if ext not in supported_extensions:
            raise ValueError(f"Unsupported file format: {ext}")
            
        if ext == ".pdf":
            from langchain_community.document_loaders import PyMuPDFLoader
            loader = PyMuPDFLoader(file_path_str)
            docs = loader.load()
            pages = [clean_pdf_text(doc.page_content) for doc in docs]
        else:
            from app.routers.context_agent import converter
            if not converter:
                raise RuntimeError("Global DocumentConverter is not initialized on the server.")
            
            result = converter.convert(file_path_str)
            doc = result.document
            
            full_text = doc.export_to_markdown()
            full_text = clean_pdf_text(full_text)
            
            page_length = 2500
            pages = [full_text[i:i+page_length] for i in range(0, len(full_text), page_length)]
    except Exception as e:
        raise ValueError(f"Failed to process document: {e}")

    if not pages:
        raise ValueError("Document yielded no readable text.")

    # Create overlapping windows
    windows = []
    step = window_size - overlap
    if step <= 0:
        step = 1
        
    for i in range(0, len(pages), step):
        window_pages = pages[i:i + window_size]
        window_text = "\n\n--- Next Section ---\n\n".join(window_pages)
        windows.append(window_text)
        
    return windows

@router.post("/generate-notes")
async def generate_notes(
    file: UploadFile = File(...),
    current_user: int = Depends(OAuth2.get_current_user)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file was uploaded")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / f"{uuid4()}{Path(file.filename).suffix}"

    try:
        with open(file_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                f.write(chunk)

        try:
            # 1. Process document and create windows
            windows = await run_in_threadpool(
                extract_and_window_pages,
                str(file_path),
                4, # window_size
                1  # overlap
            )
            
            # 2. Run sequential langgraph agent
            config = {
                "configurable": {
                    "thread_id": f"notebook_{current_user}_{uuid4().hex[:8]}"
                }
            }
            ini_state = {
                "windows": windows,
                "current_index": 0,
                "all_notes": []
            }
            
            result = await run_in_threadpool(
                agent.invoke,
                ini_state,
                config=config
            )
            
            # 3. Compile final notes
            final_notes = "\n\n---\n\n".join(result.get("all_notes", []))
            
            return {
                "message": "Notes generated successfully",
                "total_windows": len(windows),
                "notes": final_notes
            }
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Note generation failed: {str(e)}")

    finally:
        if file_path.exists():
            file_path.unlink()
