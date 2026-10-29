from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import InMemorySaver
from app.agents.research_agent.state import State
from app.agents.research_agent.nodes import (
    router_node,
    human_in_loop,
    research_node,
    orchestrator_node,
    fanout,
    worker_node,
    merge_content,
    route_human_in_loop
)

memory = InMemorySaver()

g = StateGraph(State)

g.add_node("router", router_node)
g.add_node("human_in_loop", human_in_loop)
g.add_node("research", research_node)
g.add_node("orchestrator", orchestrator_node)
g.add_node("each_section_creator", worker_node)
g.add_node("merge_content", merge_content)

g.add_edge(START, "router")
g.add_edge("router", "human_in_loop")


g.add_conditional_edges(
    "human_in_loop",
    route_human_in_loop,
    {"research": "research", "human_in_loop": "human_in_loop"}
)

g.add_edge("research", "orchestrator")

g.add_conditional_edges(
    "orchestrator",
    fanout,
    ["each_section_creator"]
)

g.add_edge("each_section_creator", "merge_content")
g.add_edge("merge_content", END)




agent = g.compile(checkpointer=memory)
