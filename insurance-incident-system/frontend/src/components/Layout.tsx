import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  HomeIcon,
  DocumentPlusIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

interface LayoutProps {
  isAgent?: boolean;
}

export default function Layout({ isAgent = false }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const customerNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'New Ticket', href: '/tickets/new', icon: DocumentPlusIcon },
  ];

  const agentNavigation = [
    { name: 'Dashboard', href: '/agent/dashboard', icon: HomeIcon },
  ];

  const navigation = isAgent ? agentNavigation : customerNavigation;

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to={isAgent ? '/agent/dashboard' : '/dashboard'} className="text-xl font-bold text-primary-400 hover:text-primary-300 transition-colors">
                  Opscident
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`${
                      location.pathname === item.href
                        ? 'border-primary-500 text-primary-400'
                        : 'border-transparent text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                  >
                    <item.icon className="h-5 w-5 mr-1" />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-slate-300">
                <UserCircleIcon className="h-6 w-6 mr-2 text-slate-500" />
                <span>{user?.first_name} {user?.last_name}</span>
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-800 text-primary-400 capitalize border border-slate-600">
                  {user?.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
