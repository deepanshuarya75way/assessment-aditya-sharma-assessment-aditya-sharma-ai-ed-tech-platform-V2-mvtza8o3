from core.config import retriever_settings


def get_retriever(id: int | None = None):
    from app.vector_store.vector_store import VECTOR_STORE

    search_kwargs = {
        "k": retriever_settings.RETRIEVER_K,
    }

    if retriever_settings.RETRIEVER_SEARCH_TYPE == "mmr":
        search_kwargs["lambda_mult"] = retriever_settings.RETRIEVER_LAMBDA_MULT

    if id is not None:
        search_kwargs["filter"] = {"id": id}

    return VECTOR_STORE.as_retriever(
        search_type=retriever_settings.RETRIEVER_SEARCH_TYPE,
        search_kwargs=search_kwargs,
    )
