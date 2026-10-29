"""Render the research-agent LangGraph as a PNG image.

Run from the repository root:
    python -m app.agents.research_agent.render_graph

Optionally supply a different output path:
    python -m app.agents.research_agent.render_graph path\\to\\graph.png
"""

from __future__ import annotations

import sys
from pathlib import Path

from app.agents.research_agent.graph import agent


DEFAULT_OUTPUT = Path(__file__).with_name("research_agent_graph.png")


def render_graph(output_path: str | Path = DEFAULT_OUTPUT) -> Path:
    """Render the compiled LangGraph and return the saved PNG path."""
    output = Path(output_path).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(agent.get_graph().draw_mermaid_png())
    return output


if __name__ == "__main__":
    destination = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT
    saved_file = render_graph(destination)
    print(f"LangGraph image saved to: {saved_file}")

