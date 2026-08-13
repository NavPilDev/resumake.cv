import os

print("Document Chunking")
print("=" * 40)


def chunk_text(text, size=100, overlap=100):
    """Smart chunking with overlap for context preservation"""
    chunks = []
    start = 0

    while start < len(text):
        end = min(start + size, len(text))
        chunk = text[start:end]
        chunks.append(chunk)
        if end >= len(text):
            break
        start += size - overlap

    return chunks
