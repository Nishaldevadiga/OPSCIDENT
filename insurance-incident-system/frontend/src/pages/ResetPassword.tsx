import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uid = searchParams.get('uid') || '';
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidLink = uid && token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(uid, token, newPassword);
      toast.success('Password reset successfully!');
      navigate('/login');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'This reset link is invalid or has expired.');
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

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-8 shadow-2xl shadow-black/20">
            {!isValidLink ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
                  <svg className="h-7 w-7 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-50 font-heading">Invalid reset link</h2>
                <p className="mt-2 text-sm text-slate-400">
                  This password reset link is invalid or missing required parameters.
                </p>
                <Link to="/forgot-password" className="mt-4 inline-block text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors">
                  Request a new reset link
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-slate-50 font-heading">Set new password</h2>
                <p className="mt-1 text-slate-400 text-sm">
                  Choose a strong password for your account.
                </p>

                <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-slate-300 mb-1.5">
                      New password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="block w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 outline-none transition-colors"
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300 mb-1.5">
                      Confirm new password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="block w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 outline-none transition-colors"
                      placeholder="Repeat your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center py-3.5 px-4 text-sm font-semibold rounded-lg text-slate-950 bg-primary-500 hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-glow"
                  >
                    {loading ? <LoadingSpinner size="sm" /> : 'Reset password'}
                  </button>

                  <p className="text-center text-sm text-slate-500">
                    <Link to="/login" className="font-medium text-primary-400 hover:text-primary-300 transition-colors">
                      Back to sign in
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
