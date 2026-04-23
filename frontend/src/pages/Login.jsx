import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import useAuth from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth(); // It is safe to use here because Auth routes will be under BrowserRouter

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to login. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 flex-col">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center border border-accent/30 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
          <Search className="text-accent" size={24} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          InvestiGraph <span className="text-accent">AI</span>
        </h1>
      </div>

      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-2xl">
        <h2 className="text-2xl font-semibold mb-6 text-white text-center">Welcome back</h2>
        
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold py-3 rounded-xl transition-colors mt-4"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-8 text-center text-muted">
          Don't have an account?{' '}
          <Link to="/signup" className="text-accent hover:underline">
            Sign up for free
          </Link>
        </p>
      </div>
    </div>
  );
}
