from pydantic import BaseModel, Field
from typing import List

class NoteSection(BaseModel):
    notes: str = Field(description="The comprehensive markdown notes generated for the given text window. Should use markdown headings, bullet points, and clear formatting.")

