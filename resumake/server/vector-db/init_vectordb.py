import chromadb
from chromadb.config import Settings

print("Initializing ChromaDB (AI Brain)")
client = chromadb.PersistentClient(
    path="./chroma_db", settings=Settings(anonymized_telemetry=False)
)

collection = client.get_or_create_collection(
    name="resumake_media", metadata={"hnsw:space": "cosine"}
)

print(f"ChromaDB initialized with {collection.count()} documents")
print(f"ChromaDB Memories: {collection.count()}")
print("AI Braing Ready!")
