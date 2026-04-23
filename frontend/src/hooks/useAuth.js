import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import useStore from '../store/useStore';

export default function useAuth() {
  const [loading, setLoading] = useState(true);
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const navigate = useNavigate();

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      navigate('/login');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate, setUser]);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    
    try {
      const { data } = await api.get('/api/auth/me');
      setUser(data);
    } catch (err) {
      console.error('Failed to restore session:', err);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('token', data.access_token);
    setUser({ id: data.user_id, email });
    navigate('/dashboard');
  };

  const register = async (email, password) => {
    const { data } = await api.post('/api/auth/register', { email, password });
    localStorage.setItem('token', data.access_token);
    setUser({ id: data.user_id, email });
    navigate('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  return { user, loading, login, register, logout };
}
