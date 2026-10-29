from langchain_groq import ChatGroq
from core.config import llm_settings
import os
from dotenv import load_dotenv

load_dotenv()

# Bot 1: Tool calling & structured output only
tool_llm = ChatGroq(
    model="qwen/qwen3.8-27b",
    temperature=0.1
)

# Bot 2: Deep research section authoring
writer_llm = ChatGroq(
    model="openai/gpt-oss-120b",
    temperature=0.3
)

# Bot 3: Synthesis and final merging
synthesizer_llm = ChatGroq(
    model="openai/gpt-oss-20b",
    temperature=0.2
)

# Default alias for compatibility
llm = writer_llm
