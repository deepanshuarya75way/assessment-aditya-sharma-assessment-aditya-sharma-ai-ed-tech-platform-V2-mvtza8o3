from typing import Literal, List, Optional
from pydantic import BaseModel, Field

class RetrieveDecision(BaseModel):
    should_retrieve: bool = Field(
        ...,
        description="True if external documents are needed to answer reliably, else False."
    )

class QuestionHeadings(BaseModel):
    question: str = Field(..., description="An individual question extracted from the user's query.")
    headings: List[str] = Field(..., description="Headings/bullet points for the answer to this specific question. The count MUST EXACTLY match the requested number of points/headings by the user. If no specific count is requested, default to exactly 5 distinct headings.", min_length=1)

class QueryBreakdown(BaseModel):
    breakdown: List[QuestionHeadings] = Field(
        ..., description="List of individual questions extracted from the query, along with their respective headings."
    )

class Answer(BaseModel):
    question: str = Field(default="", description="The question being answered.")
    heading: str = Field(..., description="Heading of one part of the answer.")
    explanation: str = Field(..., description="Clear explanation of the heading using simple, easy-to-understand words. Keep it concise.")
    formulas: Optional[List[str]] = Field(default=None, description="Provide relevant formulas if available, otherwise omit.")
    examples: Optional[List[str]] = Field(default=None, description="Provide examples to illustrate the concept clearly.")
    analogies: Optional[str] = Field(default=None, description="Provide a simple analogy ONLY if the topic contains complex technical keywords or the user EXPLICITLY asked for it (otherwise omit).")
