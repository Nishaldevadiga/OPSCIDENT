import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.08),transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/20 to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#3341550a_1px,transparent_1px),linear-gradient(to_bottom,#3341550a_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="text-2xl font-bold text-slate-50 font-heading">
              Opscident
            </Link>
          </div>

          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-8">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to sign in
          </Link>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-8 shadow-2xl shadow-black/20">
            {submitted ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <svg className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-50 font-heading">Check your email</h2>
                <p className="mt-2 text-sm text-slate-400">
                  If an account exists for <span className="text-slate-200 font-medium">{email}</span>, we've sent a password reset link. Check your inbox and follow the instructions.
                </p>
                <p className="mt-4 text-xs text-slate-500">
                  Didn't receive it? Check your spam folder or{' '}
                  <button
                    className="text-primary-400 hover:text-primary-300 transition-colors"
                    onClick={() => setSubmitted(false)}
                  >
                    try again
                  </button>
                  .
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-slate-50 font-heading">Forgot password?</h2>
                <p className="mt-1 text-slate-400 text-sm">
                  Enter your email and we'll send you a reset link.
                </p>

                <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="block w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 outline-none transition-colors"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center py-3.5 px-4 text-sm font-semibold rounded-lg text-slate-950 bg-primary-500 hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-glow"
                  >
                    {loading ? <LoadingSpinner size="sm" /> : 'Send reset link'}
                  </button>

                  <p className="text-center text-sm text-slate-500">
                    Remembered it?{' '}
                    <Link to="/login" className="font-medium text-primary-400 hover:text-primary-300 transition-colors">
                      Sign in
                    </Link>
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
