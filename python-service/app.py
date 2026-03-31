"""
Personal Digital Memory OS - AI Service
Flask API for embeddings, semantic search, OCR, and text extraction.
"""

import os
import sys
import json
import logging
import threading
from flask import Flask, request, jsonify  # type: ignore

from embeddings import EmbeddingEngine  # type: ignore
from search_engine import SearchEngine  # type: ignore
from extractors import extract_pdf, extract_docx, extract_text_file, ocr_image  # type: ignore
from assistant import MemoryAssistant  # type: ignore

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('MemoryOS-AI')

app = Flask(__name__)

# Global instances
data_path = os.environ.get('MEMORY_DATA_PATH', os.path.join(os.path.expanduser('~'), '.memory-os'))
port = int(os.environ.get('FLASK_PORT', 5678))

embedding_engine = None
search_engine = None
assistant = None


def initialize():
    """Initialize AI models and search index."""
    global embedding_engine, search_engine, assistant

    logger.info('Initializing AI service...')

    # Initialize embedding engine
    embedding_engine = EmbeddingEngine()
    logger.info('Embedding engine ready')

    # Initialize search engine
    index_path = os.path.join(data_path, 'faiss_index')
    os.makedirs(index_path, exist_ok=True)
    search_engine = SearchEngine(index_path, embedding_engine)
    logger.info('Search engine ready')

    # Initialize assistant
    db_path = os.path.join(data_path, 'memory.db')
    assistant = MemoryAssistant(db_path, search_engine)
    logger.info('Memory assistant ready')

    logger.info('AI service initialization complete')


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'embedding_ready': embedding_engine is not None,
        'search_ready': search_engine is not None,
    })


@app.route('/embed', methods=['POST'])
def embed():
    """Generate embedding for text and add to search index."""
    try:
        data = request.get_json()
        text = data.get('text', '')
        source_type = data.get('source_type', 'unknown')
        source_id = data.get('source_id')

        if not text.strip():
            return jsonify({'error': 'Empty text'}), 400

        assert embedding_engine is not None
        assert search_engine is not None

        embedding = embedding_engine.encode(text)
        doc_id = search_engine.add_document(text, embedding, source_type, source_id)

        return jsonify({
            'success': True,
            'doc_id': doc_id,
            'dimensions': len(embedding),
        })
    except Exception as e:
        logger.error(f'Embed error: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/search', methods=['POST'])
def search():
    """Semantic search over indexed documents."""
    try:
        data = request.get_json()
        query = data.get('query', '')
        top_k = data.get('top_k', 20)

        if not query.strip():
            return jsonify({'results': []})

        assert search_engine is not None

        results = search_engine.search(query, top_k)
        return jsonify({'results': results})
    except Exception as e:
        logger.error(f'Search error: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/crawl', methods=['POST'])
def crawl():
    """Trigger a background system scan."""
    try:
        assert search_engine is not None
        thread = threading.Thread(target=search_engine.crawl_system)
        thread.daemon = True
        thread.start()
        return jsonify({'success': True, 'message': 'System crawl started in background'})
    except Exception as e:
        logger.error(f'Crawl error: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/ocr', methods=['POST'])
def ocr():
    """Extract text from an image using OCR."""
    try:
        data = request.get_json()
        image_path = data.get('image_path', '')
        thumb_path = data.get('thumbnail_path', '')

        if not os.path.exists(image_path):
            return jsonify({'error': 'Image not found'}), 404

        text = ocr_image(image_path)
        return jsonify({'text': text, 'success': True})
    except Exception as e:
        logger.error(f'OCR error: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/extract', methods=['POST'])
def extract():
    """Extract text from a document (PDF, DOCX, TXT)."""
    try:
        data = request.get_json()
        file_path = data.get('file_path', '')

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        ext = os.path.splitext(file_path)[1].lower()

        if ext == '.pdf':
            text = extract_pdf(file_path)
        elif ext in ('.docx', '.doc'):
            text = extract_docx(file_path)
        elif ext in ('.txt', '.md', '.csv', '.json', '.xml', '.html', '.py', '.js', '.ts', '.css'):
            text = extract_text_file(file_path)
        else:
            return jsonify({'error': f'Unsupported file type: {ext}'}), 400

        return jsonify({'text': text, 'success': True})
    except Exception as e:
        logger.error(f'Extract error: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/summarize', methods=['POST'])
def summarize():
    """Answer a question about the user's activities."""
    try:
        data = request.get_json()
        question = data.get('question', '')

        if not question.strip():
            return jsonify({'answer': 'Please ask a question.', 'sources': []})

        assert assistant is not None

        result = assistant.answer(question)
        return jsonify(result)
    except Exception as e:
        logger.error(f'Summarize error: {e}')
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    initialize()
    print(f'AI service ready on port {port}')
    app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)
