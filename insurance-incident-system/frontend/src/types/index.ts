export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'customer' | 'agent';
  phone?: string;
  created_at: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface Ticket {
  id: number;
  ticket_id: string;
  customer: User;
  customer_name?: string;
  assigned_agent?: User;
  status: TicketStatus;
  incident_type: IncidentType;
  title: string;
  description: string;
  incident_date: string;
  incident_location?: string;
  claim_amount?: number;
  documents?: Document[];
  documents_count?: number;
  notes?: TicketNote[];
  status_history?: StatusHistory[];
  ai_analysis?: AIAnalysis;
  created_at: string;
  updated_at: string;
}

export type TicketStatus = 'submitted' | 'processing' | 'pending_info' | 'approved' | 'rejected';

export type IncidentType = 
  | 'vehicle_collision'
  | 'vehicle_theft'
  | 'property_damage'
  | 'natural_disaster'
  | 'personal_injury'
  | 'other';

export interface Document {
  id: number;
  ticket: number;
  file_type: 'pdf' | 'image';
  original_filename: string;
  file_size: number;
  file_url: string;
  uploaded_at: string;
}

export interface TicketNote {
  id: number;
  ticket: number;
  author: number;
  author_name: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface StatusHistory {
  id: number;
  old_status: string;
  new_status: string;
  changed_by: number;
  changed_by_name: string;
  reason: string;
  changed_at: string;
}

export interface AIAnalysis {
  id: number;
  extracted_data: Record<string, unknown>;
  damage_score?: number;
  fraud_indicators: string[];
  recommendation: 'approve' | 'reject' | 'review' | 'need_info';
  confidence_score: number;
  analysis_summary: string;
  pdf_analysis_complete: boolean;
  image_analysis_complete: boolean;
  is_complete: boolean;
  analyzed_at: string;
}

export interface TicketCreatePayload {
  incident_type: IncidentType;
  title: string;
  description: string;
  incident_date: string;
  incident_location?: string;
  claim_amount?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AgentStats {
  total: number;
  by_status: Record<string, number>;
  needs_attention: number;
  ai_processing: number;
  auto_approved: number;
  auto_rejected: number;
  total_claim_amount: number;
}
