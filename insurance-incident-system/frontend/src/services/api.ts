import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  LoginResponse,
  User,
  Ticket,
  Document,
  TicketCreatePayload,
  PaginatedResponse,
  AgentStats,
  AnalyticsData,
  InAppNotification,
} from '../types';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
          });
          
          localStorage.setItem('access_token', response.data.access);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
          }
          return api(originalRequest);
        }
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post('/auth/login/', { email, password });
    return response.data;
  },

  register: async (data: {
    email: string;
    password: string;
    password_confirm: string;
    first_name: string;
    last_name: string;
    phone?: string;
  }): Promise<{ message: string; user: User }> => {
    const response = await api.post('/auth/register/', data);
    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get('/auth/me/');
    return response.data;
  },

  updateProfile: async (data: { first_name: string; last_name: string; phone?: string }): Promise<User> => {
    const response = await api.patch('/auth/me/', data);
    return response.data;
  },

  changePassword: async (current_password: string, new_password: string, email?: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/change-password/', { current_password, new_password, ...(email ? { email } : {}) });
    return response.data;
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const response = await api.post('/auth/token/refresh/', { refresh });
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password/', { email });
    return response.data;
  },

  resetPassword: async (uid: string, token: string, new_password: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/reset-password/', { uid, token, new_password });
    return response.data;
  },
};

export const ticketsApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Ticket>> => {
    const response = await api.get('/tickets/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Ticket> => {
    const response = await api.get(`/tickets/${id}/`);
    return response.data;
  },

  create: async (data: TicketCreatePayload): Promise<Ticket> => {
    const response = await api.post('/tickets/', data);
    return response.data;
  },

  respond: async (id: number, message: string): Promise<{ message: string }> => {
    const response = await api.post(`/tickets/${id}/respond/`, { message });
    return response.data;
  },

  appeal: async (id: number, reason: string): Promise<{ message: string }> => {
    const response = await api.post(`/tickets/${id}/appeal/`, { reason });
    return response.data;
  },
};

export const documentsApi = {
  upload: async (ticketId: number, file: File): Promise<Document> => {
    const formData = new FormData();
    formData.append('ticket', ticketId.toString());
    formData.append('file', file);
    formData.append('original_filename', file.name);

    const response = await api.post('/documents/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  extractFields: async (file: File): Promise<{
    incident_type?: string;
    title?: string;
    description?: string;
    incident_date?: string;
    incident_location?: string;
    claim_amount?: number | null;
    confidence?: number;
    notes?: string;
    error?: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/documents/extract-fields/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export const agentApi = {
  listTickets: async (params?: Record<string, string>): Promise<PaginatedResponse<Ticket>> => {
    const response = await api.get('/agent/tickets/', { params });
    return response.data;
  },

  getTicket: async (id: number): Promise<Ticket> => {
    const response = await api.get(`/agent/tickets/${id}/`);
    return response.data;
  },

  approveTicket: async (id: number, reason?: string, approvedAmount?: number): Promise<{ message: string }> => {
    const response = await api.post(`/agent/tickets/${id}/approve/`, {
      reason,
      ...(approvedAmount != null ? { approved_amount: approvedAmount } : {}),
    });
    return response.data;
  },

  rejectTicket: async (id: number, reason: string): Promise<{ message: string }> => {
    const response = await api.post(`/agent/tickets/${id}/reject/`, { reason });
    return response.data;
  },

  requestInfo: async (id: number, message: string): Promise<{ message: string }> => {
    const response = await api.post(`/agent/tickets/${id}/request-info/`, { message });
    return response.data;
  },

  addNote: async (id: number, content: string, isInternal: boolean): Promise<{ message: string }> => {
    const response = await api.post(`/agent/tickets/${id}/notes/`, { content, is_internal: isInternal });
    return response.data;
  },

  assignTicket: async (id: number): Promise<{ message: string }> => {
    const response = await api.post(`/agent/tickets/${id}/assign/`);
    return response.data;
  },

  getStats: async (): Promise<AgentStats> => {
    const response = await api.get('/agent/tickets/stats/');
    return response.data;
  },

  getAnalytics: async (): Promise<AnalyticsData> => {
    const response = await api.get('/agent/tickets/analytics/');
    return response.data;
  },
};

export const notificationsApi = {
  list: async (): Promise<InAppNotification[]> => {
    const response = await api.get('/notifications/');
    return response.data;
  },

  unreadCount: async (): Promise<number> => {
    const response = await api.get('/notifications/unread-count/');
    return response.data.count;
  },

  markRead: async (id: number): Promise<void> => {
    await api.post(`/notifications/${id}/mark-read/`);
  },

  markAllRead: async (): Promise<void> => {
    await api.post('/notifications/mark-all-read/');
  },
};

export default api;
