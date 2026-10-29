from pinecone import Pinecone
from core.config import vector_db_settings
import os
from dotenv import load_dotenv

load_dotenv()

INDEX_NAME = vector_db_settings.INDEX_NAME
PINECONE_API_KEY = vector_db_settings.PINECONE_API_KEY

# Initialize official Pinecone client
pc = Pinecone(api_key=PINECONE_API_KEY)

# Connect to the integrated inference index
# Pinecone handles embedding automatically using llama-text-embed-v2 configured on this index
INDEX = pc.Index(INDEX_NAME)


def upsert_chunks(chunks, current_user: int, filename: str, namespace: str = "default"):
    """
    Upserts text chunks directly to Pinecone using integrated inference.
    Pinecone automatically embeds `chunk_text` into 1024-dimensional vectors.
    """
    records = []
    for idx, chunk in enumerate(chunks):
        records.append({
            "_id": f"usr_{current_user}_{filename}_{idx}_{chunk.metadata.get('source', '')}",
            "chunk_text": chunk.page_content,
            "title": filename,
            "id": current_user
        })

    # Upsert in batches of 64
    batch_size = 64
    total_upserted = 0
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        INDEX.upsert_records(namespace=namespace, records=batch)
        total_upserted += len(batch)

    return total_upserted
