import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authApi.login(formData.email, formData.password);
      setAuth(response.user, response.access, response.refresh);
      toast.success('Login successful!');
      navigate(response.user.role === 'agent' ? '/agent/dashboard' : '/dashboard');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-primary-600/5" />
      <div className="relative max-w-md w-full space-y-8">
        <Link to="/" className="inline-block text-sm text-slate-500 hover:text-slate-400 transition-colors mb-4">
          ← Back to home
        </Link>
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-slate-50 font-heading">
            Opscident
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Sign in to your account
          </p>
        </div>
        <form className="mt-8 space-y-6 p-8 rounded-2xl bg-slate-900/50 border border-slate-700/50 backdrop-blur" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 input px-3 py-2"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 input px-3 py-2"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-slate-950 bg-primary-500 hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-primary-500 disabled:opacity-50 transition-all"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <Link to="/register" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
              Don't have an account? Register here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
