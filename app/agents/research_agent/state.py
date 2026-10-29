from typing import TypedDict, List, Optional, Annotated
from app.agents.research_agent.schemas import EvidenceItem, Plan
import operator


class State(TypedDict):
    topic: str

    # routing / research
    mode: str
    needs_research: bool
    queries: List[str]
    evidence: List[EvidenceItem]
    plan: Optional[Plan]

    # recency control
    as_of: str           
    recency_days: int    # 7 for weekly news, 30 for hybrid

    sections: Annotated[list, operator.add]
    merged_md: str
    user_feedback: str
