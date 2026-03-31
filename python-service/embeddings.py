"""
Embedding Engine using Sentence Transformers.
Generates semantic embeddings for text content.
"""

import logging
import numpy as np

logger = logging.getLogger('MemoryOS-AI.embeddings')


class EmbeddingEngine:
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        self.model_name = model_name
        self.model = None
        self.dimension = 384
        self._load_model()

    def _load_model(self):
        """Load the sentence transformer model."""
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f'Loading model: {self.model_name}')
            self.model = SentenceTransformer(self.model_name)
            self.dimension = self.model.get_sentence_embedding_dimension()
            logger.info(f'✅ Model loaded. Dimension: {self.dimension}')
        except Exception as e:
            logger.error(f'❌ Failed to load model: {e}')
            logger.warning('Using random embeddings as fallback')
            self.model = None

    def encode(self, text: str):
        """Single text ka embedding generate karo - numpy array return karta hai."""
        if self.model is None:
            return np.random.randn(self.dimension).astype(np.float32)

        # Bohot lamba text truncate karo
        if len(text) > 10000:
            text = text[:10000]

        # ✅ FIX - numpy array return karo, .tolist() nahi
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.astype(np.float32)

    def encode_batch(self, texts: list, batch_size=32):
        """Multiple texts ka embedding ek saath generate karo."""
        if self.model is None:
            return [np.random.randn(self.dimension).astype(np.float32) for _ in texts]

        # Lamba text truncate karo
        texts = [t[:10000] if len(t) > 10000 else t for t in texts]

        # ✅ FIX - numpy array return karo, .tolist() nahi
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True
        )
        return embeddings.astype(np.float32)

    def encode_for_api(self, text: str):
        """
        Flask API endpoint ke liye - list return karta hai
        (JSON mein numpy array nahi bheja ja sakta)
        """
        embedding = self.encode(text)
        return embedding.tolist()


# ✅ Test
if __name__ == "__main__":
    engine = EmbeddingEngine()

    # Single text test
    result = engine.encode("Hello world test")
    print(f"✅ Single encode: shape={result.shape}, type={type(result)}")

    # Batch test
    batch = engine.encode_batch(["Text one", "Text two", "Text three"])
    print(f"✅ Batch encode: shape={batch.shape}")

    # API test
    api_result = engine.encode_for_api("API test")
    print(f"✅ API encode: type={type(api_result)}, length={len(api_result)}")