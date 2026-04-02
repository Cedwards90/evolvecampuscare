import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useFileNotes(studentId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['file-notes', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('file_notes')
        .select('*')
        .eq('student_id', studentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
  });

  const addNote = useMutation({
    mutationFn: async ({ content, noteType = 'general' }: { content: string; noteType?: string }) => {
      const { error } = await supabase
        .from('file_notes')
        .insert({
          student_id: studentId!,
          author_id: user!.id,
          content,
          note_type: noteType,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-notes', studentId] });
    },
  });

  return { notes, isLoading, addNote };
}
