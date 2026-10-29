from typing import List, TypedDict

class State(TypedDict):
    windows: List[str]
    current_index: int
    all_notes: List[str]
