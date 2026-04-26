import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { setToken, fetchWithAuth, isAuthenticated } from '../utils/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { AppBackground } from '../components/ui/AppBackground';

export function AuthPage() {
    const [searchParams] = useSearchParams();
    const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Auto-update if query param changes
    useEffect(() => {
        setIsLogin(searchParams.get('mode') !== 'signup');
    }, [searchParams]);

    // Redirect to workspace if already authenticated
    useEffect(() => {
        if (isAuthenticated()) {
            navigate('/workspace', { replace: true });
        }
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
        
        try {
            const res = await fetchWithAuth(endpoint, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Authentication failed');
                setIsLoading(false);
                return;
            }

            if (isLogin) {
                setToken(data.token);
                navigate('/workspace');
            } else {
                // Auto login after signup
                const loginRes = await fetchWithAuth('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                const loginData = await loginRes.json();
                if (loginRes.ok) {
                    setToken(loginData.token);
                    navigate('/workspace');
                } else {
                    setIsLogin(true);
                    setError('Signup successful! Please log in.');
                }
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-4 selection:bg-cyan-500/30">
            <AppBackground />

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold tracking-tight mb-2">
                        Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">CUE X</span>
                    </h1>
                    <p className="text-gray-400 text-sm">
                        {isLogin ? 'Sign in to access your workspaces' : 'Create an account to start analyzing'}
                    </p>
                </div>

                <div className="glass-card p-8 rounded-2xl shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5 ml-1">Email</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-500" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all"
                                        placeholder="you@company.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5 ml-1">Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-500" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-white text-black font-medium py-3 px-4 rounded-xl hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all flex items-center justify-center space-x-2 group mt-6"
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError('');
                            }}
                            className="text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            {isLogin 
                                ? "Don't have an account? Sign up" 
                                : "Already have an account? Sign in"}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
