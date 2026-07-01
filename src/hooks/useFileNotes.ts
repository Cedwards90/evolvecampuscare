import { useEffect } from 'react';
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
  contact_date: string | null;
  contact_type: string | null;
  duration_minutes: number | null;
  identified_needs: number[];
  referral_agency: string | null;
  referral_contact: string | null;
  next_steps: string | null;
};

export type FileNoteInput = {
  content: string;
  noteType?: string;
  title?: string | null;
  contactDate?: string | null;
  contactType?: string | null;
  durationMinutes?: number | null;
  identifiedNeeds?: number[];
  referralAgency?: string | null;
  referralContact?: string | null;
  nextSteps?: string | null;
};

function rowToCols(input: FileNoteInput) {
  return {
    content: input.content,
    note_type: input.noteType ?? 'case_note',
    title: input.title?.trim() || null,
    contact_date: input.contactDate || null,
    contact_type: input.contactType || null,
    duration_minutes:
      input.durationMinutes !== undefined && input.durationMinutes !== null
        ? Number(input.durationMinutes)
        : null,
    identified_needs: input.identifiedNeeds ?? [],
    referral_agency: input.referralAgency?.trim() || null,
    referral_contact: input.referralContact?.trim() || null,
    next_steps: input.nextSteps?.trim() || null,
  };
}

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
        .order('contact_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FileNote[];
    },
    enabled: !!studentId,
  });

  // Realtime: keep this student's notes list fresh across tabs and viewers
  useEffect(() => {
    if (!studentId) return;
    const channel = supabase
      .channel(`file_notes:${studentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'file_notes', filter: `student_id=eq.${studentId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['file-notes', studentId] }); queryClient.invalidateQueries({ queryKey: ['recent-case-notes'] });
          queryClient.invalidateQueries({ queryKey: ['recent-case-notes'] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [studentId, queryClient]);


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
    author_initials:
      authorMap.get(n.author_id)?.full_name
        ?.split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 3) || null,
  }));

  const addNote = useMutation({
    mutationFn: async (input: FileNoteInput) => {
      const { error } = await supabase.from('file_notes').insert({
        student_id: studentId!,
        author_id: user!.id,
        ...rowToCols(input),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-notes', studentId] }); queryClient.invalidateQueries({ queryKey: ['recent-case-notes'] });
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, ...input }: FileNoteInput & { id: string }) => {
      const { error } = await supabase
        .from('file_notes')
        .update(rowToCols(input) as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-notes', studentId] }); queryClient.invalidateQueries({ queryKey: ['recent-case-notes'] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('file_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-notes', studentId] }); queryClient.invalidateQueries({ queryKey: ['recent-case-notes'] });
    },
  });

  return { notes: notesWithAuthor, isLoading, addNote, updateNote, deleteNote };
}
