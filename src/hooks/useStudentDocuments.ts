import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const BUCKET = 'student-documents';

export const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_DOCS_PER_STUDENT = 50;

export const ALLOWED_DOC_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
];

export const DOCUMENT_CATEGORIES = [
  { value: 'id_documents', label: 'ID & documents' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'resume', label: 'Resume' },
  { value: 'medical', label: 'Medical' },
  { value: 'legal', label: 'Court / legal' },
  { value: 'education', label: 'Education & training' },
  { value: 'other', label: 'Other' },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]['value'];

export function categoryLabel(value: string): string {
  return DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label ?? 'Other';
}

export interface StudentDocument {
  id: string;
  student_id: string;
  category: string;
  description: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  uploader_name?: string | null;
}

export function useStudentDocuments(studentId: string | undefined) {
  return useQuery({
    queryKey: ['student-documents', studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<StudentDocument[]> => {
      const { data, error } = await supabase
        .from('student_documents')
        .select('*')
        .eq('student_id', studentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ids = Array.from(new Set((data ?? []).map((d) => d.uploaded_by)));
      let names: Record<string, string | null> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', ids);
        names = Object.fromEntries(
          (profs ?? []).map((p: any) => [p.user_id, p.full_name || p.email]),
        );
      }
      return (data ?? []).map((d) => ({
        ...d,
        uploader_name: names[d.uploaded_by] ?? null,
      })) as StudentDocument[];
    },
  });
}

export interface UploadDocumentInput {
  file: File;
  category: DocumentCategory;
  description?: string | null;
}

export function useUploadStudentDocument(studentId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ file, category, description }: UploadDocumentInput) => {
      if (!user) throw new Error('Not signed in');
      if (file.size > MAX_DOC_SIZE) {
        throw new Error(`"${file.name}" is larger than 10 MB.`);
      }
      if (file.type && !ALLOWED_DOC_MIME.includes(file.type)) {
        throw new Error(`"${file.name}" has an unsupported file type.`);
      }

      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${studentId}/${crypto.randomUUID()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('student_documents').insert({
        student_id: studentId,
        category,
        description: description?.trim() || null,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user.id,
      });
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-documents', studentId] });
    },
    onError: (e: Error) => toast.error(e.message || 'Upload failed'),
  });
}

export function useDeleteStudentDocument(studentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: StudentDocument) => {
      const { error } = await supabase.from('student_documents').delete().eq('id', doc.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([doc.file_path]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-documents', studentId] });
      toast.success('Document removed');
    },
    onError: (e: Error) => toast.error(e.message || 'Delete failed'),
  });
}

export async function getStudentDocumentUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60 * 5);
  if (error) return null;
  return data?.signedUrl ?? null;
}
