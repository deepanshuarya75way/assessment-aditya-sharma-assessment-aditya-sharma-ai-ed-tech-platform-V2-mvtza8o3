from .state import State
from .llm import llm
from .prompts import notes_generation_prompt
from .schemas import NoteSection

def generate_notes(state: State):
    windows = state.get("windows", [])
    current_index = state.get("current_index", 0)
    all_notes = state.get("all_notes", [])
    
    if current_index >= len(windows):
        return state # Safety check

    current_window_text = windows[current_index]
    previous_notes = all_notes[-1] if all_notes else "No previous notes available. This is the beginning of the book."
    
    prompt = notes_generation_prompt.format_messages(
        previous_notes=previous_notes,
        current_window_text=current_window_text
    )
    
    response = llm.invoke(prompt)
    
    new_notes = all_notes + [response.content]
    
    return {
        "all_notes": new_notes,
        "current_index": current_index + 1
    }
