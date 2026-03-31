# Personal Digital Memory OS

**Personal Digital Memory OS** is an AI-powered desktop application designed to act as a comprehensive, visually stunning, local "digital memory" system. It continuously tracks your PC activity—including active applications, clipboard contents, browser history, file modifications, and screenshots—while completely safeguarding your privacy via a secure local database and local AI models.

## Features

- **Comprehensive Tracking:**
  - **Window Tracker:** Keeps a log of the active windows you are viewing.
  - **App Collector:** Monitors the applications running on your machine.
  - **Clipboard Monitor:** Captures copied text and entries.
  - **Browser History:** Synchronizes and archives web browsing history.
  - **File Watcher:** Monitors changes across your defined folders.
  - **Smart Screenshots:** Periodically captures and analyzes screen content.

- **AI-Powered Capabilities:**
  - **Semantic Search Engine:** Find anything in your digital memory using natural language instead of exact keywords via FAISS vector storage and SentenceTransformers.
  - **Conversational Assistant:** Ask questions about your activities and let the local conversational AI help retrieve your memories.
  - **Data Extractor:** Supports OCR (Optical Character Recognition) via Tesseract, parses PDFs using PyPDF2, and reads Word documents.

- **Privacy-First Architecture:**
  - Everything runs 100% locally on your machine.
  - All tracking data is stored in a local SQLite database (`userData/memory-data`).
  - Embeddings are generated locally using the bundled Python service.

## Tech Stack

### Frontend UI
- **React 18** (styled natively and enhanced with Framer Motion and Lucide React)
- **Vite** (Build tool)
- **React Router v6** (Navigation)
- **React Markdown** (Rich rendering of AI assistant output)

### Desktop Wrapper
- **Electron 28** (Native desktop interactions, system tray, auto-launch, frameless transparent window)

### Local AI & Backend Service
- **Python 3.9+**
- **Flask** (Service interface for Electron)
- **Sentence-Transformers & FAISS** (Vector Embeddings & Semantic Search)
- **PyTesseract & Pillow** (Image OCR for screenshots)
- **PyPDF2 & python-docx** (Document Text Extraction)

## Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/downloads/) (3.9+)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) (Must be installed on the system for screenshot analysis)

### 1. Clone the repository
```bash
git clone <repository-url>
cd "Personal Digital Memory OS"
```

### 2. Node Dependencies
Install the required Node.js packages for the Electron and React frontend.
```bash
npm install
```

### 3. Python Backend Setup
Install the necessary Python packages for the local AI and data extraction service.
```bash
pip install -r python-service/requirements.txt
```

## Running the App

### Development Mode
To start both the Vite dev server and the Electron app concurrently:
```bash
npm run dev
```
*Note: The Electron main process will attempt to spin up the background Python service automatically at startup (this may take over 30 seconds initially). The app runs silently in the system tray and begins tracking immediately depending on your settings.*

### Building for Production
To package the app into a standalone executable (`.exe` for Windows NSIS):
```bash
npm run build
```
During the build process, the `python-service` is bundled alongside the application as an extra resource, enabling a complete standalone experience once installed.

## Tracking Settings
On application launch, you will see an icon in your system tray. From there, you can interact with the app, enable or disable tracking, and securely access the Personal Digital Memory OS interface to explore and search your tracked history.

## Development Notes
- Make sure that python is effectively in your system `PATH` and mapped to `python` or `python3` command (depending on your `electron/python-bridge.js` configuration) to ensure the Electron app spawns the background service correctly.
