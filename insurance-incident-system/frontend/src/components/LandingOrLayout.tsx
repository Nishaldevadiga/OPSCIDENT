import { useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Home from '../pages/Home';
import Layout from './Layout';

export default function LandingOrLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    if (location.pathname === '/') return <Home />;
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'agent') {
    return <Navigate to="/agent/dashboard" replace />;
  }

  if (location.pathname === '/') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout />;
}
