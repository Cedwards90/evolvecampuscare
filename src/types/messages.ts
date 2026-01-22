import type { Profile } from './database';

export interface StaffMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  student_id: string | null;
  request_id: string | null;
  subject: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
  // Joined data
  sender?: Profile;
  recipient?: Profile;
  student?: Profile;
}

export interface Conversation {
  other_user: Profile;
  last_message: StaffMessage;
  unread_count: number;
}
