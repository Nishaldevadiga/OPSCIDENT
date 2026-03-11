import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

import Login from './pages/Login';
import Register from './pages/Register';
import CustomerDashboard from './pages/customer/Dashboard';
import CustomerTicketCreate from './pages/customer/TicketCreate';
import CustomerTicketDetail from './pages/customer/TicketDetail';
import AgentDashboard from './pages/agent/Dashboard';
import AgentTicketDetail from './pages/agent/TicketDetail';
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
        <Route path="/register" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />
        } />

        <Route path="/" element={
          <ProtectedRoute allowedRoles={['customer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<CustomerDashboard />} />
          <Route path="tickets/new" element={<CustomerTicketCreate />} />
          <Route path="tickets/:id" element={<CustomerTicketDetail />} />
        </Route>

        <Route path="/agent" element={
          <ProtectedRoute allowedRoles={['agent']}>
            <Layout isAgent />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/agent/dashboard" replace />} />
          <Route path="dashboard" element={<AgentDashboard />} />
          <Route path="tickets/:id" element={<AgentTicketDetail />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
