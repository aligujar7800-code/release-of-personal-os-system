import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';


export default function AssistantPanel() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const suggestions = [
        'What did I work on yesterday?',
        'Show my most used files',
        'Find documents about AI',
        'Summarize this week\'s activity',
    ];

    async function handleSend() {
        const question = input.trim();
        if (!question || isLoading) return;

        const userMessage = { role: 'user', content: question, timestamp: new Date() };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            let response;
            if (window.electronAPI) {
                response = await window.electronAPI.askAssistant(question);
            } else {
                // Demo response
                await new Promise(r => setTimeout(r, 1000));
                response = getDemoResponse(question);
            }

            const assistantMessage = {
                role: 'assistant',
                content: response.answer || response.text || 'I couldn\'t find relevant information for that query.',
                sources: response.sources || [],
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            }]);
        }
        setIsLoading(false);
        inputRef.current?.focus();
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    function handleSuggestion(text) {
        setInput(text);
        setTimeout(() => {
            setInput(text);
            handleSendWithText(text);
        }, 100);
    }

    async function handleSendWithText(text) {
        if (!text || isLoading) return;

        const userMessage = { role: 'user', content: text, timestamp: new Date() };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            let response;
            if (window.electronAPI) {
                response = await window.electronAPI.askAssistant(text);
            } else {
                await new Promise(r => setTimeout(r, 1000));
                response = getDemoResponse(text);
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.answer || 'No results found.',
                sources: response.sources || [],
                timestamp: new Date(),
            }]);
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, an error occurred.',
                timestamp: new Date(),
            }]);
        }
        setIsLoading(false);
        setInput('');
    }

    return (
        <div className="page-container" style={{ height: 'calc(100vh - var(--header-height))', paddingBottom: 0 }}>
            <div className="assistant-container">
                <div className="assistant-messages">
                    {messages.length === 0 ? (
                        <div className="assistant-welcome">
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧠</div>
                            <h2>Memory Assistant</h2>
                            <p>Ask me anything about your digital activity. I can help you find files, summarize your work, and recall past activities.</p>
                            <div className="assistant-suggestions">
                                {suggestions.map((s, i) => (
                                    <button key={i} className="suggestion-btn" onClick={() => handleSuggestion(s)}>
                                        💡 {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <div key={i} className={`message ${msg.role}`}>
                                <div className="message-avatar">
                                    {msg.role === 'assistant' ? '🧠' : '👤'}
                                </div>
                                <div className={`message-bubble ${msg.role === 'assistant' ? 'markdown-body' : ''}`}>
                                    {msg.role === 'assistant' ? (
                                        <div className="markdown-body">
                                            <ReactMarkdown
                                                components={{
                                                    a: ({ node, ...props }) => {
                                                        // Handle custom click actions for sources
                                                        return <a {...props} onClick={(e) => {
                                                            e.preventDefault();
                                                            const path = props.href;
                                                            if (path.endsWith('.lnk') || path.includes('Program Files')) {
                                                                window.electronAPI.launchApp(path);
                                                            } else {
                                                                window.electronAPI.openFile(path);
                                                            }
                                                        }} style={{ cursor: 'pointer', color: 'var(--accent-primary)' }} />;
                                                    }
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))
                    )}

                    {isLoading && (
                        <div className="message assistant">
                            <div className="message-avatar">🧠</div>
                            <div className="message-bubble">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div className="spinner" style={{ width: '16px', height: '16px' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>Thinking...</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <div className="assistant-input-area">
                    <div className="assistant-input-wrapper">
                        <input
                            ref={inputRef}
                            className="assistant-input"
                            type="text"
                            placeholder="Ask about your activities, files, or history..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                        />
                        <button
                            className="assistant-send-btn"
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getDemoResponse(question) {
    const q = question.toLowerCase();

    if (q.includes('yesterday') || q.includes('work on')) {
        return {
            answer: `📅 **Activity Summary for Yesterday**\n\n**Activity Breakdown:**\n  • ✏️ Files Modified: 12\n  • 📄 Files Created: 3\n  • 🌐 Websites Visited: 28\n  • 📋 Clipboard Copies: 8\n  • 📸 Screenshots: 24\n\n**Recent Activities:**\n  • [18:30] Modified Project_Report.docx in Documents\n  • [17:45] Visited github.com/my-project\n  • [16:20] Created analysis_results.csv\n  • [15:10] Modified budget_tracker.xlsx\n  • [14:00] Visited stackoverflow.com - React hooks question`,
            sources: [],
        };
    }

    if (q.includes('most used') || q.includes('frequently')) {
        return {
            answer: `📂 **Most Used Files (This Week)**\n\n  1. **Project_Report.docx** — 34 interactions\n     📁 C:\\Users\\Documents\n  2. **main.py** — 28 interactions\n     📁 C:\\Users\\Projects\n  3. **data_analysis.ipynb** — 22 interactions\n     📁 C:\\Users\\Projects\\ML\n  4. **meeting_notes.txt** — 15 interactions\n     📁 C:\\Users\\Documents\n  5. **budget_2024.xlsx** — 12 interactions\n     📁 C:\\Users\\Documents`,
            sources: [],
        };
    }

    return {
        answer: `🔍 **Search Results for:** "${question}"\n\n  • [92% match] Project_Proposal.pdf - AI research methodology outline\n    Source: Documents\n  • [85% match] meeting_notes.docx - Discussion about AI tools and frameworks\n    Source: Documents\n  • [78% match] browser visit: openai.com - Exploring AI capabilities\n    Source: Web browsing\n  • [71% match] screenshot - Contains text about machine learning models\n    Source: Screenshots`,
        sources: [],
    };
}
