from app.agents.research_agent.schemas import ResearchMetadata
from datetime import date, timedelta
from pathlib import Path
from typing import List
from langchain_core.messages import SystemMessage, HumanMessage
from app.agents.research_agent.state import State
from app.agents.research_agent.schemas import (
    RouterDecision,
    EvidenceItem,
    EvidencePack,
    Plan,
    Task,
    UpdatedQueries,
    ResearchMetadata,
)
from app.agents.research_agent.prompts import (
    RESEARCH_SYSTEM,
    ORCH_SYSTEM,
    WORKER_SYSTEM,
    ROUTER_SYSTEM,
    USER_FEEDBACK_REVIEWER,
)
from app.agents.research_agent.config import (
    tool_llm,
    writer_llm,
    synthesizer_llm,
)
from langgraph.types import Send, interrupt, Command
from app.agents.research_agent.utils import _tavily_search, _iso_to_date


def router_node(state: State) -> dict:
    topic = state["topic"]
    decider = tool_llm.with_structured_output(RouterDecision)
    decision = decider.invoke(
        [
            SystemMessage(content=ROUTER_SYSTEM),
            HumanMessage(content=f"Topic: {topic}\nAs-of date: {state['as_of']}"),
        ]
    )

    # Set default recency window based on mode
    if decision.mode == "open_book":
        recency_days = 7
    elif decision.mode == "hybrid":
        recency_days = 45
    else:
        recency_days = 3650

    return {
        "needs_research": decision.needs_research,
        "mode": decision.mode,
        "queries": decision.queries,
        "recency_days": recency_days,
    }


def human_in_loop(state: State):
    queries = state.get("queries", [])

    if len(queries) == 0:
        return {"user_feedback": "start"}

    user_feedback = interrupt(
        '''Please review the research queries. \n
        Would you like to start research or modify the research queries?\n\n
        Enter the modifications if any.
        '''
    )

    feedback_text = user_feedback
    if isinstance(user_feedback, dict):
        if user_feedback.get("selected_queries"):
            queries = user_feedback["selected_queries"]
        feedback_text = user_feedback.get("feedback") or "start"

    if feedback_text == 'start' or not feedback_text:
        return {'queries': queries, 'user_feedback': 'start'}

    review_llm = tool_llm.with_structured_output(UpdatedQueries)

    prompt_text = USER_FEEDBACK_REVIEWER.format(
        topic=state['topic'],
        user_feedback=feedback_text,
        queries=queries,
    )

    updated_queries = review_llm.invoke([HumanMessage(content=prompt_text)])

    return {'queries': updated_queries.queries, 'user_feedback': feedback_text}


def route_human_in_loop(state: State) -> str:
    if state.get("user_feedback") == "start":
        return "research"
    return "human_in_loop"


def research_node(state: State) -> dict:
    queries = (state.get("queries", []) or [])[:10]
    max_results = 6

    raw_results: List[dict] = []
    for q in queries:
        raw_results.extend(_tavily_search(q, max_results=max_results))

    if not raw_results:
        return {"evidence": []}

    # Map raw results directly to EvidenceItems to avoid LLM context/output limits
    # and deduplicate by URL natively.
    dedup = {}
    for r in raw_results:
        url = r.get("url")
        if url and url not in dedup:
            snippet = r.get("snippet") or ""
            dedup[url] = EvidenceItem(
                title=r.get("title", ""),
                url=url,
                published_at=r.get("published_at"),
                snippet=snippet,
                source=r.get("source"),
            )

    evidence = list(dedup.values())

    mode = state.get("mode", "closed_book")
    if mode == "open_book":
        as_of = date.fromisoformat(state["as_of"][:10])
        cutoff = as_of - timedelta(days=int(state["recency_days"]))
        fresh: List[EvidenceItem] = []
        for e in evidence:
            d = _iso_to_date(e.published_at)
            if d and d >= cutoff:
                fresh.append(e)
        evidence = fresh

    return {"evidence": evidence}


def orchestrator_node(state: State) -> dict:
    planner = tool_llm.with_structured_output(ResearchMetadata)
    evidence = state.get("evidence", [])
    mode = state.get("mode", "closed_book")
    queries = state.get("queries", [])

    forced_kind = "news_roundup" if mode == "open_book" else None

    metadata = planner.invoke(
        [
            SystemMessage(content=ORCH_SYSTEM),
            HumanMessage(
                content=(
                    f"Topic: {state['topic']}\n"
                    f"Mode: {mode}\n"
                    f"As-of: {state['as_of']} (recency_days={state['recency_days']})\n"
                    f"{'Force blog_kind=news_roundup' if forced_kind else ''}\n\n"
                    f"Evidence (ONLY use for fresh claims; may be empty):\n"
                    f"{[e.model_dump() for e in evidence][:16]}\n\n"
                    f"Instruction: Generate the blog metadata. We will automatically create sections based on the user's queries."
                )
            ),
        ]
    )

    if forced_kind:
        metadata.blog_kind = "news_roundup"

    tasks = []
    for i, q in enumerate(queries):
        tasks.append(
            Task(
                id=i,
                title=q,
                goal=f"Focus ONLY on this query: '{q}'. Write a comprehensive section addressing this query based on the provided evidence context.",
                bullets=[
                    f"Summarize the most important findings for '{q}'",
                    f"Synthesize any relevant tools, examples, or data from the evidence related to '{q}'",
                    f"Provide actionable takeaways or insights regarding '{q}'",
                ],
                target_words=300,
                requires_research=True,
                requires_citations=True,
            )
        )

    plan = Plan(
        blog_title=metadata.blog_title,
        audience=metadata.audience,
        tone=metadata.tone,
        blog_kind=metadata.blog_kind,
        constraints=metadata.constraints,
        tasks=tasks,
    )

    return {"plan": plan}


def fanout(state: State):
    assert state["plan"] is not None
    return [
        Send(
            "each_section_creator",
            {
                "task": task.model_dump(),
                "topic": state["topic"],
                "mode": state["mode"],
                "as_of": state["as_of"],
                "recency_days": state["recency_days"],
                "plan": state["plan"].model_dump(),
                "evidence": [e.model_dump() for e in state.get("evidence", [])],
            },
        )
        for task in state["plan"].tasks
    ]


def worker_node(payload: dict) -> dict:
    task = Task(**payload["task"])
    plan = Plan(**payload["plan"])
    evidence = [EvidenceItem(**e) for e in payload.get("evidence", [])]
    topic = payload["topic"]
    mode = payload.get("mode", "closed_book")
    as_of = payload.get("as_of")
    recency_days = payload.get("recency_days")

    bullets_text = "\n- " + "\n- ".join(task.bullets)

    # Provide a compact evidence list for citation use
    evidence_text = ""
    if evidence:
        evidence_text = "\n".join(
            f"- {e.title} | {e.url} | {e.published_at or 'date:unknown'}".strip()
            for e in evidence[:20]
        )

    section_md = writer_llm.invoke(
        [
            SystemMessage(content=WORKER_SYSTEM),
            HumanMessage(
                content=(
                    f"Blog title: {plan.blog_title}\n"
                    f"Audience: {plan.audience}\n"
                    f"Tone: {plan.tone}\n"
                    f"Blog kind: {plan.blog_kind}\n"
                    f"Constraints: {plan.constraints}\n"
                    f"Topic: {topic}\n"
                    f"Mode: {mode}\n"
                    f"As-of: {as_of} (recency_days={recency_days})\n\n"
                    f"Section title: {task.title}\n"
                    f"Goal: {task.goal}\n"
                    f"Target words: {task.target_words}\n"
                    f"Tags: {task.tags}\n"
                    f"requires_research: {task.requires_research}\n"
                    f"requires_citations: {task.requires_citations}\n"
                    f"requires_code: {task.requires_code}\n"
                    f"Bullets:{bullets_text}\n\n"
                    f"Evidence (ONLY use these URLs when citing):\n{evidence_text}\n"
                )
            ),
        ]
    ).content.strip()

    # deterministic ordering
    return {"sections": [(task.id, section_md)]}


def merge_content(state: State) -> dict:
    plan = state["plan"]
    ordered_sections = [md for _, md in sorted(state["sections"], key=lambda x: x[0])]
    body = "\n\n".join(ordered_sections).strip()

    prompt = [
        SystemMessage(
            content="You are an expert technical editor. Combine the following research sections into a cohesive, publication-grade markdown article with seamless transitions between sections. Keep all citations, code, and technical findings intact. Start with an # H1 title."
        ),
        HumanMessage(content=f"Title: {plan.blog_title}\n\nSections:\n{body}"),
    ]
    try:
        merged_md = synthesizer_llm.invoke(prompt).content.strip()
        return {"merged_md": merged_md}
    except Exception:
        return {"merged_md": f"# {plan.blog_title}\n\n{body}\n"}
