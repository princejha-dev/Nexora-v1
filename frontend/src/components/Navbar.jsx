import React from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import useAuth from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30 shadow-[0_0_10px_rgba(250,204,21,0.2)]">
              <Search className="text-accent" size={18} />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              InvestiGraph <span className="text-accent">AI</span>
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link to="/dashboard" className="text-sm font-medium text-white hover:text-accent transition-colors">
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="text-sm font-medium text-muted hover:text-white transition-colors ml-4"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-white hover:text-accent transition-colors">
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="text-sm font-semibold text-black bg-accent hover:bg-yellow-500 px-4 py-2 rounded-lg transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
