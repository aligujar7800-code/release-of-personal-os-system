"""
Search Engine using FAISS + sentence-transformers
"""

import os
import json
import uuid
import logging
import numpy as np

logger = logging.getLogger('MemoryOS-AI.search')


# ✅ MISSING PIECE - Yeh add karo
class EmbeddingEngine:
    def __init__(self):
        from sentence_transformers import SentenceTransformer
        logger.info("⏳ Embedding model load ho raha hai...")
        self.model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        self.dimension = 384
        logger.info("✅ Embedding model ready!")

    def encode(self, text):
        """Text ko vector mein convert karo"""
        return self.model.encode(text, convert_to_numpy=True)


class SearchEngine:
    def __init__(self, index_path, embedding_engine):
        self.index_path = index_path
        self.embedding_engine = embedding_engine
        self.dimension = embedding_engine.dimension
        self.index = None
        self.documents = {}
        self.doc_ids = []
        os.makedirs(index_path, exist_ok=True)  # ✅ Folder auto-create
        self._load_or_create_index()

    def _load_or_create_index(self):
        """Load existing FAISS index or create new one."""
        try:
            import faiss
            index_file = os.path.join(self.index_path, 'index.faiss')
            meta_file = os.path.join(self.index_path, 'metadata.json')

            if os.path.exists(index_file) and os.path.exists(meta_file):
                try:
                    self.index = faiss.read_index(index_file)
                    with open(meta_file, 'r') as f:
                        data = json.load(f)
                        self.documents = data.get('documents', {})
                        self.doc_ids = data.get('doc_ids', [])
                    logger.info(f'✅ FAISS index loaded: {self.index.ntotal} vectors')
                except Exception as e:
                    logger.warning(f'Index corrupted ({e}), fresh start')
                    self.index = faiss.IndexFlatIP(self.dimension)
                    self.documents = {}
                    self.doc_ids = []
            else:
                self.index = faiss.IndexFlatIP(self.dimension)
                logger.info('✅ New FAISS index created')
        except ImportError:
            logger.warning('❌ FAISS not installed - pip install faiss-cpu')
            self.index = None

    def save_index(self):
        """FAISS index disk pe save karo."""
        if self.index is None:
            return
        try:
            import faiss
            index_file = os.path.join(self.index_path, 'index.faiss')
            meta_file = os.path.join(self.index_path, 'metadata.json')

            faiss.write_index(self.index, index_file)
            with open(meta_file, 'w') as f:
                json.dump({
                    'documents': self.documents,
                    'doc_ids': self.doc_ids,
                }, f, indent=2)
            logger.info(f'💾 Index saved: {self.index.ntotal} vectors')
        except Exception as e:
            logger.error(f'❌ Save failed: {e}')

    def add_document(self, text, embedding, source_type, source_id=None):
        """Memory mein naya document add karo."""
        doc_id = str(uuid.uuid4())

        self.documents[doc_id] = {
            'text': text[:500],
            'source_type': source_type,
            'source_id': source_id,
        }
        self.doc_ids.append(doc_id)

        if self.index is not None:
            vector = np.array([embedding], dtype=np.float32)
            norm = np.linalg.norm(vector)
            if norm > 0:
                vector = vector / norm
            self.index.add(vector)

            if self.index.ntotal % 100 == 0:
                self.save_index()

        return doc_id

    # ✅ NEW - Delete support
    def delete_document(self, doc_id):
        """Document memory se hatao."""
        if doc_id in self.documents:
            del self.documents[doc_id]
            self.doc_ids = [d for d in self.doc_ids if d != doc_id]
            logger.info(f'🗑️ Deleted: {doc_id}')
            return True
        return False

    def crawl_system(self):
        """Local files index karo - Windows + Linux dono."""
        import platform
        extensions = {'.pdf', '.docx', '.txt', '.md', '.py', '.js'}
        skip_dirs = {'appdata', 'windows', 'node_modules', '.git', '__pycache__'}

        # ✅ Windows aur Linux dono handle karo
        if platform.system() == 'Windows':
            import string
            from ctypes import windll
            bitmask = windll.kernel32.GetLogicalDrives()
            roots = [f"{l}:\\" for l in string.ascii_uppercase if bitmask & (1 << (ord(l) - ord('A')))]
        else:
            roots = [os.path.expanduser('~')]  # Linux/Mac home folder

        logger.info(f"🔍 File crawl shuru: {roots}")

        for root_path in roots:
            for root, dirs, files in os.walk(root_path):
                dirs[:] = [d for d in dirs if d.lower() not in skip_dirs and not d.startswith('.')]
                for file in files:
                    if os.path.splitext(file)[1].lower() in extensions:
                        full_path = os.path.join(root, file)
                        embedding = self.embedding_engine.encode(f"File: {file} Path: {full_path}")
                        self.add_document(file, embedding, 'system_file', full_path)

        self.save_index()
        logger.info("✅ File crawl complete!")

    def search(self, query, top_k=20):
        """Natural language se memories search karo."""
        query_embedding = self.embedding_engine.encode(query)
        query_vector = np.array([query_embedding], dtype=np.float32)

        norm = np.linalg.norm(query_vector)
        if norm > 0:
            query_vector = query_vector / norm

        if self.index is None or self.index.ntotal == 0:
            return []

        k = min(top_k, self.index.ntotal)
        scores, indices = self.index.search(query_vector, k)

        results = []
        for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
            if idx < 0 or idx >= len(self.doc_ids):
                continue
            doc_id = self.doc_ids[idx]
            doc = self.documents.get(doc_id, {})
            results.append({
                'doc_id': doc_id,
                'score': float(score),
                'text': doc.get('text', ''),
                'source_type': doc.get('source_type', ''),
                'source_id': doc.get('source_id'),
                'rank': i + 1,
            })

        return results


# ✅ Test karo directly
if __name__ == "__main__":
    engine = EmbeddingEngine()
    search = SearchEngine('./test_index', engine)

    # Kuch memories add karo
    texts = [
        "Maine Chrome mein YouTube dekha",
        "VS Code mein Python code likha",
        "Gmail check kiya subah",
        "WhatsApp pe message kiya dost ko",
    ]
    for text in texts:
        emb = engine.encode(text)
        search.add_document(text, emb, 'test')

    # Search karo
    results = search.search("browser history")
    print("\n🔍 Search Results:")
    for r in results:
        print(f"  [{r['rank']}] {r['text']} (score: {r['score']:.3f})")

    search.save_index()