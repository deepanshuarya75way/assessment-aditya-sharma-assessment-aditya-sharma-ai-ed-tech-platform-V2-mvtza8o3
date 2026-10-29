from langgraph.graph import StateGraph, START, END
from .state import State
from .nodes import generate_notes

def route_next(state: State):
    windows = state.get("windows", [])
    current_index = state.get("current_index", 0)
    if current_index < len(windows):
        return "generate_notes"
    return END

g = StateGraph(State)

g.add_node("generate_notes", generate_notes)

g.add_edge(START, "generate_notes")

g.add_conditional_edges(
    "generate_notes",
    route_next,
    {
        "generate_notes": "generate_notes",
        END: END
    }
)

agent = g.compile()
