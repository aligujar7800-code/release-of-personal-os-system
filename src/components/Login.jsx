import React, { useState } from 'react';
import { Lock, LogIn, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login({ onAuthenticated }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();

        if (!password) {
            setError('Please enter your password.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            if (window.electronAPI) {
                const isValid = await window.electronAPI.verifyPassword(password);
                if (isValid) {
                    onAuthenticated();
                } else {
                    setError('Incorrect password. Please try again.');
                    setPassword('');
                }
            } else {
                // Dev fallback
                if (password === 'admin') onAuthenticated();
                else setError('Incorrect password (dev: admin)');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#0a0a1a', zIndex: 9999,
            backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.15), transparent 50%), radial-gradient(circle at 100% 100%, rgba(56, 189, 248, 0.1), transparent 50%)',
            WebkitAppRegion: 'drag' // Allow moving window from background
        }}>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                    WebkitAppRegion: 'no-drag', // Inputs need to be non-draggable
                    background: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '24px',
                    padding: '48px',
                    width: '100%',
                    maxWidth: '420px',
                    boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}
            >
                <div style={{
                    width: '64px', height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '24px',
                    boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4)'
                }}>
                    <Lock size={32} color="white" />
                </div>

                <h1 style={{
                    fontSize: '28px', fontWeight: '700', color: 'white', marginBottom: '8px', textAlign: 'center'
                }}>
                    Welcome Back
                </h1>

                <p style={{
                    fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '32px', textAlign: 'center'
                }}>
                    Please enter your password to access your Memory OS.
                </p>

                <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div className="search-input-container" style={{ margin: 0 }}>
                        <Lock className="search-icon" size={20} />
                        <input
                            type="password"
                            autoFocus
                            placeholder="Enter password..."
                            className="search-input"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError('');
                            }}
                            style={{ height: '52px', fontSize: '15px' }}
                            disabled={isLoading}
                        />
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    color: 'var(--accent-red)', fontSize: '13px',
                                    padding: '8px 12px', borderRadius: '8px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    overflow: 'hidden'
                                }}
                            >
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        type="submit"
                        disabled={isLoading || !password}
                        style={{
                            height: '52px',
                            background: isLoading ? 'rgba(255, 255, 255, 0.1)' : 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: '600',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            cursor: (isLoading || !password) ? 'not-allowed' : 'pointer',
                            marginTop: '8px',
                            transition: 'all 0.2s',
                            opacity: (isLoading || !password) ? 0.6 : 1
                        }}
                    >
                        {isLoading ? 'Verifying...' : 'Unlock Memory OS'}
                        {!isLoading && <LogIn size={18} />}
                    </button>

                </form>

            </motion.div>
        </div>
    );
}
