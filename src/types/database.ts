// Application-level type definitions

export type AppRole = 'student' | 'case_manager' | 'admin';

export type RequestStatus = 'submitted' | 'in_progress' | 'escalated' | 'resolved' | 'cancelled';

export type RequestPriority = 'low' | 'medium' | 'high' | 'emergency';

export type RequestCategory = 'academic' | 'financial' | 'mental_health' | 'housing' | 'other';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface SupportRequest {
  id: string;
  student_id: string;
  assigned_case_manager_id: string | null;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  title: string;
  description: string;
  is_emergency: boolean;
  escalated_at: string | null;
  resolved_at: string | null;
  requested_amount: number | null;
  approved_amount: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  student?: Profile;
  case_manager?: Profile;
}

export interface RequestUpdate {
  id: string;
  request_id: string;
  user_id: string;
  previous_status: RequestStatus | null;
  new_status: RequestStatus | null;
  note: string | null;
  is_internal: boolean;
  created_at: string;
  // Joined data
  user?: Profile;
}

export interface Appointment {
  id: string;
  request_id: string | null;
  student_id: string;
  case_manager_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Joined data
  student?: Profile;
  case_manager?: Profile;
  request?: SupportRequest;
}

export interface RequestAttachment {
  id: string;
  request_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface OfflineDraft {
  id: string;
  user_id: string;
  draft_data: {
    category: RequestCategory;
    priority: RequestPriority;
    title: string;
    description: string;
    is_emergency: boolean;
  };
  synced: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIInsight {
  id: string;
  request_id: string | null;
  case_manager_id: string | null;
  insight_type: string;
  content: Record<string, unknown>;
  is_dismissed: boolean;
  created_at: string;
}

// Dashboard stats
export interface DashboardStats {
  totalRequests: number;
  pendingRequests: number;
  resolvedRequests: number;
  emergencyRequests: number;
  avgResolutionTime: number;
}

export interface CaseManagerWorkload {
  case_manager_id: string;
  case_manager: Profile;
  active_requests: number;
  emergency_requests: number;
  avg_response_time: number;
}
