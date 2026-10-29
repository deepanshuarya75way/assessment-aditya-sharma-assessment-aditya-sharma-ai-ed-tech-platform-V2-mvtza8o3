from fastapi import APIRouter, Depends, HTTPException
from OAuth2 import OAuth2
from pydantic import BaseModel
from fastapi.concurrency import run_in_threadpool
from datetime import datetime
from uuid import uuid4

from app.agents.research_agent.graph import agent
from langgraph.types import Command

router = APIRouter(
    prefix="/research-agent",
    tags=["research"],
)

class ResearchRequest(BaseModel):
    topic: str

class FeedbackRequest(BaseModel):
    thread_id: str
    feedback: str

@router.post("/launch")
async def launch_research(
    request: ResearchRequest,
    current_user: int = Depends(OAuth2.get_current_user)
):
    try:
        thread_id = f"research_{current_user}_{uuid4().hex[:8]}"
        config = {
            "configurable": {
                "thread_id": thread_id
            }
        }
        ini_state = {
            "topic": request.topic,
            "as_of": datetime.now().isoformat()
        }
        
        result = await run_in_threadpool(
            agent.invoke,
            ini_state,
            config
        )
        
        state = agent.get_state(config)
        
        # If the graph is suspended, we return the queries and the thread_id
        if state.next:
            return {
                "status": "awaiting_feedback",
                "thread_id": thread_id,
                "message": "Please review the research queries.",
                "queries": result.get("queries", [])
            }
            
        return {
            "status": "completed",
            "message": "Research completed successfully",
            "final_answer": result.get("merged_md", "No output generated."),
            "evidence": [e.model_dump() for e in result.get("evidence", [])]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Research failed: {str(e)}")


@router.post("/feedback")
async def research_feedback(
    request: FeedbackRequest,
    current_user: int = Depends(OAuth2.get_current_user)
):
    try:
        config = {
            "configurable": {
                "thread_id": request.thread_id
            }
        }
        
        if not request.thread_id.startswith(f"research_{current_user}_"):
            raise HTTPException(status_code=403, detail="Invalid thread ID")

        state = agent.get_state(config)
        if not state.next:
            raise HTTPException(status_code=400, detail="Research is not awaiting feedback.")

        # Resume the workflow with the user's feedback
        result = await run_in_threadpool(
            agent.invoke,
            Command(resume=request.feedback),
            config
        )
        
        new_state = agent.get_state(config)
        if new_state.next:
            return {
                "status": "awaiting_feedback",
                "thread_id": request.thread_id,
                "message": "Please review further questions.",
                "queries": result.get("queries", [])
            }
            
        return {
            "status": "completed",
            "message": "Research completed successfully",
            "final_answer": result.get("merged_md", "No output generated."),
            "evidence": [e.model_dump() for e in result.get("evidence", [])]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Research feedback failed: {str(e)}")
