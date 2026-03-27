import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

import Login from './pages/Login';
import AgentLogin from './pages/AgentLogin';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LandingOrLayout from './components/LandingOrLayout';
import CustomerDashboard from './pages/customer/Dashboard';
import CustomerTicketCreate from './pages/customer/TicketCreate';
import CustomerTicketDetail from './pages/customer/TicketDetail';
import AgentDashboard from './pages/agent/Dashboard';
import AgentTicketDetail from './pages/agent/TicketDetail';
import AgentAnalytics from './pages/agent/Analytics';
import Profile from './pages/Profile';
import ChangePassword from './pages/ChangePassword';
import Layout from './components/Layout';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'agent' ? '/agent/dashboard' : '/dashboard'} replace />;
  }

  return <>{children}</>;
}

function App() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <Router>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' } }} />
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to={user?.role === 'agent' ? '/agent/dashboard' : '/dashboard'} replace /> : <Login />
        } />
        <Route path="/agent/login" element={
          isAuthenticated ? <Navigate to={user?.role === 'agent' ? '/agent/dashboard' : '/dashboard'} replace /> : <AgentLogin />
        } />
        <Route path="/register" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />
        } />

        <Route path="/" element={<LandingOrLayout />}>
          <Route path="dashboard" element={<CustomerDashboard />} />
          <Route path="tickets/new" element={<CustomerTicketCreate />} />
          <Route path="tickets/:id" element={<CustomerTicketDetail />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/agent" element={
          <ProtectedRoute allowedRoles={['agent']}>
            <Layout isAgent />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/agent/dashboard" replace />} />
          <Route path="dashboard" element={<AgentDashboard />} />
          <Route path="analytics" element={<AgentAnalytics />} />
          <Route path="tickets/:id" element={<AgentTicketDetail />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/change-password" element={<ChangePassword />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
