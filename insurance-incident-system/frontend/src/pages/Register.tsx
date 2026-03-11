import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.password_confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await authApi.register(formData);
      toast.success('Registration successful! Please login.');
      navigate('/login');
    } catch (error: unknown) {
      const err = error as { response?: { data?: Record<string, string[]> } };
      const errorData = err.response?.data;
      if (errorData) {
        const firstError = Object.values(errorData)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : String(firstError));
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Register for Opscident
          </p>
        </div>
        <form className="mt-8 space-y-6 p-8 rounded-2xl bg-slate-900/50 border border-slate-700/50 backdrop-blur" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-slate-300">First Name</label>
                <input id="first_name" name="first_name" type="text" required className="mt-1 input px-3 py-2" value={formData.first_name} onChange={handleChange} />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-slate-300">Last Name</label>
                <input id="last_name" name="last_name" type="text" required className="mt-1 input px-3 py-2" value={formData.last_name} onChange={handleChange} />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" required className="mt-1 input px-3 py-2" value={formData.email} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-300">Phone (optional)</label>
              <input id="phone" name="phone" type="tel" className="mt-1 input px-3 py-2" value={formData.phone} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">Password</label>
              <input id="password" name="password" type="password" required className="mt-1 input px-3 py-2" value={formData.password} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="password_confirm" className="block text-sm font-medium text-slate-300">Confirm Password</label>
              <input id="password_confirm" name="password_confirm" type="password" required className="mt-1 input px-3 py-2" value={formData.password_confirm} onChange={handleChange} />
            </div>
          </div>

          <div>
            <button type="submit" disabled={loading} className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-slate-950 bg-primary-500 hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-primary-500 disabled:opacity-50 transition-all">
              {loading ? <LoadingSpinner size="sm" /> : 'Register'}
            </button>
          </div>

          <div className="text-center">
            <Link to="/login" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
