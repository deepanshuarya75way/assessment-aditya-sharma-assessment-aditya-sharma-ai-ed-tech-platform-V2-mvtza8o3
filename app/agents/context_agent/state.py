from typing import List, Literal, Optional, Annotated, TypedDict
import operator
from .schemas import Answer
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage
from langchain_core.documents import Document

class State(TypedDict):
    chat_history: Annotated[List[BaseMessage], add_messages]
    id: Optional[int]
    user_query: str
    rewrite_query: str

    use_strictly_retriever: bool
    docs_available: bool
    retrieval_needed: bool
    retrieved_docs: Optional[List[Document]]

    questions_with_headings: Optional[List[dict]]
    answers: Annotated[List[Answer], operator.add]
    final_answer: str
