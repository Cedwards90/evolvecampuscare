import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile } from '@/types/database';
import type { StaffMessage, Conversation } from '@/types/messages';

export function useMessages() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['messages', user?.id],
    queryFn: async (): Promise<StaffMessage[]> => {
      if (!user?.id) return [];

      const { data: messages, error } = await supabase
        .from('staff_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!messages) return [];

      // Get unique user IDs for profiles
      const userIds = new Set<string>();
      messages.forEach((m) => {
        userIds.add(m.sender_id);
        userIds.add(m.recipient_id);
        if (m.student_id) userIds.add(m.student_id);
      });

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', Array.from(userIds));

      const profileMap = new Map<string, Profile>();
      profiles?.forEach((p) => profileMap.set(p.user_id, p as Profile));

      // Enrich messages with profiles
      return messages.map((m) => ({
        ...m,
        sender: profileMap.get(m.sender_id) || undefined,
        recipient: profileMap.get(m.recipient_id) || undefined,
        student: m.student_id ? profileMap.get(m.student_id) : undefined,
      })) as StaffMessage[];
    },
    enabled: !!user?.id,
  });
}

export function useConversations() {
  const { user } = useAuth();
  const { data: messages, isLoading, error } = useMessages();

  const conversations: Conversation[] = [];
  
  if (messages && user?.id) {
    const conversationMap = new Map<string, { messages: StaffMessage[]; other_user: Profile }>();
    
    messages.forEach((m) => {
      const otherId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      const otherProfile = m.sender_id === user.id ? m.recipient : m.sender;
      
      if (!conversationMap.has(otherId) && otherProfile) {
        conversationMap.set(otherId, { messages: [], other_user: otherProfile });
      }
      conversationMap.get(otherId)?.messages.push(m);
    });

    conversationMap.forEach((data, id) => {
      const sortedMessages = data.messages.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      conversations.push({
        other_user: data.other_user,
        last_message: sortedMessages[0],
        unread_count: sortedMessages.filter((m) => !m.is_read && m.recipient_id === user.id).length,
      });
    });

    // Sort by most recent message
    conversations.sort(
      (a, b) => new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
    );
  }

  return { conversations, isLoading, error };
}

export function useConversation(otherUserId: string | undefined) {
  const { user } = useAuth();
  const { data: messages, isLoading, error } = useMessages();

  const conversationMessages = messages?.filter(
    (m) =>
      (m.sender_id === user?.id && m.recipient_id === otherUserId) ||
      (m.sender_id === otherUserId && m.recipient_id === user?.id)
  ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) || [];

  const otherUser = conversationMessages[0]?.sender_id === user?.id 
    ? conversationMessages[0]?.recipient 
    : conversationMessages[0]?.sender;

  return { messages: conversationMessages, otherUser, isLoading, error };
}

export function useUnreadCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['messages-unread', user?.id],
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;

      const { count, error } = await supabase
        .from('staff_messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      recipientId,
      content,
      subject,
      studentId,
      requestId,
    }: {
      recipientId: string;
      content: string;
      subject?: string;
      studentId?: string;
      requestId?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase.from('staff_messages').insert({
        sender_id: user.id,
        recipient_id: recipientId,
        content,
        subject: subject || null,
        student_id: studentId || null,
        request_id: requestId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['messages-unread'] });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageIds: string[]) => {
      const { error } = await supabase
        .from('staff_messages')
        .update({ is_read: true })
        .in('id', messageIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['messages-unread'] });
    },
  });
}

export function useStaffMembers() {
  const { user, role } = useAuth();

  return useQuery({
    queryKey: ['staff-members', role, user?.id],
    queryFn: async (): Promise<Profile[]> => {
      if (!user?.id) return [];

      // Students can only message their assigned case manager and admins
      if (role === 'student') {
        // Get assigned case manager
        const { data: assignment } = await supabase
          .from('student_assignments')
          .select('case_manager_id')
          .eq('student_id', user.id)
          .maybeSingle();

        const recipients: string[] = [];

        // Add assigned case manager if exists
        if (assignment?.case_manager_id) {
          recipients.push(assignment.case_manager_id);
        }

        // Also get all admins
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        if (adminRoles) {
          adminRoles.forEach((r) => {
            if (!recipients.includes(r.user_id)) {
              recipients.push(r.user_id);
            }
          });
        }

        if (recipients.length === 0) return [];

        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', recipients);

        if (error) throw error;
        return (profiles || []) as Profile[];
      }

      // Case managers and admins can message all staff
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['case_manager', 'admin']);

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map((r) => r.user_id).filter((id) => id !== user?.id);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      return (profiles || []) as Profile[];
    },
    enabled: !!user?.id,
  });
}
