from langchain_nvidia_ai_endpoints import ChatNVIDIA
import os
from dotenv import load_dotenv

load_dotenv()

llm = ChatNVIDIA(
    model="nvidia/nemotron-3.5-bolt-e4b",
    nvidia_api_key=os.getenv("NVIDIA_API_KEY")
)
