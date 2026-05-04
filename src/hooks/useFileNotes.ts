import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type FileNote = {
  id: string;
  student_id: string;
  author_id: string;
  content: string;
  note_type: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

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
      return (data || []) as FileNote[];
    },
    enabled: !!studentId,
  });

  // Hydrate author names
  const authorIds = Array.from(new Set(notes.map((n) => n.author_id)));
  const { data: authors = [] } = useQuery({
    queryKey: ['file-notes-authors', authorIds.sort().join(',')],
    queryFn: async () => {
      if (authorIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', authorIds);
      if (error) throw error;
      return data || [];
    },
    enabled: authorIds.length > 0,
  });
  const authorMap = new Map(authors.map((a) => [a.user_id, a]));
  const notesWithAuthor = notes.map((n) => ({
    ...n,
    author_name: authorMap.get(n.author_id)?.full_name || authorMap.get(n.author_id)?.email || 'Unknown',
  }));

  const addNote = useMutation({
    mutationFn: async ({
      content,
      noteType = 'case_note',
      title,
    }: {
      content: string;
      noteType?: string;
      title?: string | null;
    }) => {
      const { error } = await supabase.from('file_notes').insert({
        student_id: studentId!,
        author_id: user!.id,
        content,
        note_type: noteType,
        title: title?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-notes', studentId] });
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({
      id,
      content,
      noteType,
      title,
    }: {
      id: string;
      content: string;
      noteType: string;
      title?: string | null;
    }) => {
      const { error } = await supabase
        .from('file_notes')
        .update({
          content,
          note_type: noteType,
          title: title?.trim() || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-notes', studentId] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('file_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-notes', studentId] });
    },
  });

  return { notes: notesWithAuthor, isLoading, addNote, updateNote, deleteNote };
}
