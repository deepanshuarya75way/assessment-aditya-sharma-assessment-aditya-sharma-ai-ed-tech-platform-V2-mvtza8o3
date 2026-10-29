from langgraph.graph import StateGraph, START, END
from .state import State
from .nodes import (
    rewrite_query,
    decide_retrieval,
    route_after_decide,
    retrieval,
    generate_headings,
    create_workers,
    create_bullet_point,
    join
)

g = StateGraph(State)

g.add_node("rewrite_query", rewrite_query)
g.add_node("decide_retrieval", decide_retrieval)
g.add_node("retrieval", retrieval)
g.add_node("generate_headings", generate_headings)
g.add_node("create_bullet_point", create_bullet_point)
g.add_node("join", join)

g.add_edge(START, "rewrite_query")
g.add_edge("rewrite_query", "decide_retrieval")

# Conditional branch after decision
g.add_conditional_edges(
    "decide_retrieval",
    route_after_decide,
    {
        "retrieve": "retrieval",
        "generate_direct": "generate_headings",
    },
)

# After retrieval, continue to headings
g.add_edge("retrieval", "generate_headings")

# Fan out per heading, then join
g.add_conditional_edges("generate_headings", create_workers)
g.add_edge("create_bullet_point", "join")

g.add_edge("join", END)

agent = g.compile()