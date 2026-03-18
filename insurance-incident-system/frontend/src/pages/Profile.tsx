import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Profile() {
  const { user, updateUser } = useAuthStore();

  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
  });
  const [profileLoading, setProfileLoading] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const updated = await authApi.updateProfile(profileForm);
      updateUser(updated);
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase();
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50 font-heading">Profile</h1>
        <p className="mt-1 text-sm text-slate-400">Manage your account information</p>
      </div>

      {/* Profile card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center gap-4">
          <div className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold ${
            user?.role === 'agent'
              ? 'bg-indigo-500/15 border border-indigo-500/25 text-indigo-300'
              : 'bg-primary-500/15 border border-primary-500/25 text-primary-300'
          }`}>
            {initials || '?'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {user?.first_name} {user?.last_name}
            </h2>
            <p className="text-sm text-slate-400">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                user?.role === 'agent'
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                  : 'bg-primary-500/15 text-primary-400 border border-primary-500/20'
              }`}>
                {user?.role}
              </span>
              <span className="text-xs text-slate-500">Member since {memberSince}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit profile */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="text-base font-semibold text-slate-100 mb-1">Personal information</h3>
        <p className="text-sm text-slate-400 mb-6">Update your name and contact details</p>

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">First name</label>
              <input
                type="text"
                required
                value={profileForm.first_name}
                onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                className="block w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 outline-none transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Last name</label>
              <input
                type="text"
                required
                value={profileForm.last_name}
                onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                className="block w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 outline-none transition-colors text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="block w-full rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-2.5 text-slate-500 outline-none text-sm cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-slate-500">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone number</label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
              className="block w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 outline-none transition-colors text-sm"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={profileLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg text-slate-950 bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {profileLoading ? <LoadingSpinner size="sm" /> : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Security */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="text-base font-semibold text-slate-100 mb-1">Security</h3>
        <p className="text-sm text-slate-400 mb-4">Manage your password and account security</p>
        <Link
          to="/change-password"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-600 hover:bg-slate-800/50 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          Change password
        </Link>
      </div>
    </div>
  );
}
