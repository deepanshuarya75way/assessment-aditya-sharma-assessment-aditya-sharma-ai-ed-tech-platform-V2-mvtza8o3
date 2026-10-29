from core.config import llm_settings
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_groq import ChatGroq
from dotenv import load_dotenv
import os
load_dotenv()

gen_llm = ChatGroq(
    model="openai/gpt-oss-120b"
)
reasoning_llm = ChatGroq(
    model="openai/gpt-oss-120b"
)