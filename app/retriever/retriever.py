from core.config import retriever_settings
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

RETRIEVERS = {}

embed_model_name = "sentence-transformers/all-MiniLM-L6-v2"
embed_model = HuggingFaceEmbeddings(
    model_name = embed_model_name
)


def create_retriever(chunks, id: int | None = None):
    vec_store = FAISS.from_documents(chunks, embed_model)

    retriever = vec_store.as_retriever(search_type = retriever_settings.RETRIEVER_SEARCH_TYPE,
    search_kwargs= {'k':retriever_settings.RETRIEVER_K, "lambda_mult": retriever_settings.RETRIEVER_LAMBDA_MULT})

    RETRIEVERS[id] = retriever


def get_retriever(id: int):
    return RETRIEVERS[id]

