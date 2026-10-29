from langgraph.types import Send
from .state import State
from .llm import gen_llm, reasoning_llm
from .prompts import (
    rewrite_prompt,
    retrieval_decision_prompt,
    headings_prompt,
    heading_answer_prompt,
)
from .schemas import RetrieveDecision, QueryBreakdown, Answer
from typing import Literal
from langchain.messages import AIMessage
from app.retriever.retriever import get_retriever


def rewrite_query(state: State):
    question = state.get("user_query")
    chat_history = state.get("chat_history") or []

    prompt = rewrite_prompt.format_messages(
        chat_history=chat_history[-5:],
        user_query=question,
    )
    rewritten_query = gen_llm.invoke(prompt)

    return {"rewrite_query": rewritten_query.content}

def decide_retrieval(state: State):
    if state.get("use_strictly_retriever") or state.get("docs_available"):
        return {"retrieval_needed": True}

    chat_history = state.get("chat_history") or []
    question = state.get("rewrite_query")

    prompt = retrieval_decision_prompt.format_messages(
        chat_history=chat_history[-5:],
        user_query=question,
    )
    decision = reasoning_llm.with_structured_output(RetrieveDecision).invoke(prompt)

    return {"retrieval_needed": decision.should_retrieve}

def route_after_decide(state: State) -> Literal["generate_direct", "retrieve"]:
    return "retrieve" if state["retrieval_needed"] else "generate_direct"

def retrieval(state: State):
    question = state.get("rewrite_query")
    id = state.get("id")
    retriever = get_retriever(id=id)
    docs = retriever.invoke(question)
    return {"retrieved_docs": docs}

def generate_headings(state: State):
    question = state.get("rewrite_query")
    chat_history = state.get("chat_history") or []
    retrieved_docs = state.get("retrieved_docs") or []
    use_strictly_retriever = state.get("use_strictly_retriever", False)

    # Format the retrieved documents into a string
    retrieved_context = "\n\n".join([doc.page_content for doc in retrieved_docs]) if retrieved_docs else "No specific documents retrieved."

    # Decide instructions based on strictly retriever flag
    if use_strictly_retriever:
        context_instructions = (
            "You MUST strictly base your headings ONLY on the provided Retrieved Context. "
            "Do NOT generate headings for topics or information that are not present in the context. "
            "If the context does not contain enough information for the requested number of headings, "
            "only generate as many headings as the context supports."
        )
    elif retrieved_docs:
        context_instructions = (
            "Use the provided Retrieved Context to inform and enrich your headings. "
            "You may also use your own knowledge, but prioritize the fetched documents."
        )
    else:
        context_instructions = "Use your own knowledge to generate headings."

    prompt = headings_prompt.format_messages(
        chat_history=chat_history[-5:],
        user_query=question,
        retrieved_context=retrieved_context,
        context_instructions=context_instructions
    )
    breakdown_response = reasoning_llm.with_structured_output(QueryBreakdown).invoke(prompt)

    # Convert the pydantic models to dicts before putting in state
    return {"questions_with_headings": [qh.dict() for qh in breakdown_response.breakdown]}

def create_workers(state: State):
    questions_with_headings = state.get("questions_with_headings") or []
    chat_history = state.get("chat_history") or []
    retrieved_docs = state.get("retrieved_docs") or []
    use_strictly_retriever = state.get("use_strictly_retriever", False)

    # Format the retrieved documents into a string
    retrieved_context = "\n\n".join([doc.page_content for doc in retrieved_docs]) if retrieved_docs else "No specific documents retrieved."

    # Decide instructions based on strictly retriever flag
    if use_strictly_retriever:
        context_instructions = (
            "You MUST strictly base your entire answer ONLY on the provided Retrieved Context. "
            "Do NOT use any outside knowledge. If the answer cannot be found in the context, state that explicitly."
        )
    elif retrieved_docs:
        context_instructions = (
            "Use the provided Retrieved Context to inform and enrich your answer. "
            "You may also use your own knowledge, but prioritize the fetched documents."
        )
    else:
        context_instructions = "Use your own knowledge."

    workers = []
    for qh in questions_with_headings:
        for heading in qh["headings"]:
            workers.append(Send(
                'create_bullet_point',
                {
                    'question': qh["question"],
                    'heading': heading,
                    'chat_history': chat_history[-5:],
                    'retrieved_context': retrieved_context,
                    'context_instructions': context_instructions
                }
            ))
    return workers

def create_bullet_point(payload: dict) -> dict:
    question = payload.get("question")
    heading = payload.get("heading")
    chat_history = payload.get("chat_history")
    retrieved_context = payload.get("retrieved_context", "")
    context_instructions = payload.get("context_instructions", "")

    prompt = heading_answer_prompt.format_messages(
        user_query=question,
        heading=heading,
        chat_history=chat_history,
        retrieved_context=retrieved_context,
        context_instructions=context_instructions
    )
    answer = gen_llm.with_structured_output(Answer).invoke(prompt)
    answer.question = question # Ensure question is set

    return {"answers": [answer]}

def join(state: State):
    answers = state.get("answers") or []
    
    # group by question
    grouped_answers = {}
    for a in answers:
        q = getattr(a, 'question', 'Answer')
        if not q:
            q = 'Answer'
        if q not in grouped_answers:
            grouped_answers[q] = []
        grouped_answers[q].append(a)
    
    final_text_parts = []
    for q, ans_list in grouped_answers.items():
        if q and q != "Answer":
            final_text_parts.append(f"### {q}")
        
        formulas_all = []
        examples_all = []
        analogies_all = []

        for ans in ans_list:
            expl = " ".join(ans.explanation) if isinstance(ans.explanation, list) else ans.explanation
            bullet = f"- **{ans.heading}**: {expl}"
            final_text_parts.append(bullet)
            
            if ans.formulas: formulas_all.extend(ans.formulas)
            if ans.examples: examples_all.extend(ans.examples)
            if ans.analogies and ans.analogies not in analogies_all: analogies_all.append(ans.analogies)
            
        if formulas_all:
            final_text_parts.append(f"formula: {', '.join(formulas_all)}")
        if examples_all:
            final_text_parts.append(f"example: {' | '.join(examples_all)}")
        if analogies_all:
            final_text_parts.append(f"analogy: {' | '.join(analogies_all)}")
            
        final_text_parts.append("")

    joined_answer = "\n".join(final_text_parts).strip()
    return {"final_answer": joined_answer, "chat_history": [AIMessage(content=joined_answer)]}
