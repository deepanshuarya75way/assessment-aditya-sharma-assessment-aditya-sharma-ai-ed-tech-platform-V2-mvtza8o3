from pydantic_settings import BaseSettings
from pydantic import Field

class JWTSettings(BaseSettings):
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    SECRET_KEY: str
    ALGORITHM: str

    class Config:
        env_file = ".env"
        extra = "ignore"

jwt_settings = JWTSettings()


class DBSettings(BaseSettings):
    DATABASE_NAME: str
    DATABASE_USERNAME: str
    DATABASE_PASSWORD: str
    DATABASE_HOSTNAME: str
    DATABASE_PORT: int

    class Config:
        env_file = ".env"
        extra = "ignore"

db_settings = DBSettings()

class Document(BaseSettings):
    DOCUMENTS_DIR: str = Field(default="documents")
    DOCUMENTS_PATH: str = Field(default="documents")

    class Config:
        env_file = ".env"
        extra = "ignore"

document_settings = Document()

class VectorDBSettings(BaseSettings):
    INDEX_NAME: str = Field(...)
    PINECONE_API_KEY: str = Field(...)

    class Config:
        env_file = ".env"
        extra = "ignore"

vector_db_settings = VectorDBSettings()

class LLMSettings(BaseSettings):
    LLM_GOOGLE: str = "gemini-2.5-flash"
    LLM_GROQ_OPENAI: str = "openai/gpt-oss-120b"
    LLM_GROQ_OPENAI_20B: str = "openai/gpt-oss-20b"
    LLM_GROQ_QWEN: str = "qwen/qwen3.8-27b"
    LLM_GROQ_LLAMA: str = "llama-3.3-70b-versatile"
    LLM_NVIDIA: str = "meta/llama-3.3-70b-instruct"
    LLM_REASONING_TEMPERATURE: float = 0
    LLM_GENERATION_TEMPERATURE: float = 0.6
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    RERANKER_MODEL_NAME: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    GROQ_API_KEY: str

    class Config:
        env_file = ".env"
        extra = "ignore"

llm_settings = LLMSettings()

class RetrieverSettings(BaseSettings):
    RETRIEVER_SEARCH_TYPE: str = "mmr"
    RETRIEVER_K: int = 5
    RETRIEVER_LAMBDA_MULT: float = 0.6

    

retriever_settings = RetrieverSettings()


from pydantic_settings import BaseSettings, SettingsConfigDict


class MongoDB(BaseSettings):
    MONGO_USERNAME: str
    MONGO_PASSWORD: str
    MONGO_CLUSTER: str
    MONGO_KEY: str

    class Config:
        env_file = ".env"
        extra = "ignore"

mongoDB = MongoDB()
