'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import config from '../../config';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { login, isLoggedIn } = useAuth();

    // Redirect to dashboard if already logged in
    useEffect(() => {
        if (isLoggedIn) {
            router.replace('/dashboard');
        }
    }, [isLoggedIn, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`${config.apiServer}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Use AuthContext login to properly sync state across app
            login(data.token, data.user);

            if (data.user.forceChangePassword) {
                router.push('/change-password');
            } else {
                router.push('/dashboard');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-sm bg-white border border-slate-200 shadow-sm rounded-xl p-8">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg mx-auto flex items-center justify-center mb-4 text-white font-bold text-xl shadow-blue-200 shadow-lg">M</div>
                    <h1 className="text-2xl font-bold text-slate-900">Sign In</h1>
                    <p className="text-slate-500 text-sm mt-2">Welcome back to the Meeting System</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            placeholder="Ex. johndoe"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-slate-100 pt-6">
                    <button
                        type="button"
                        onClick={() => router.push('/forgot-password')}
                        className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                    >
                        Forgot your password?
                    </button>
                </div>
            </div>
        </div>
    );
}
