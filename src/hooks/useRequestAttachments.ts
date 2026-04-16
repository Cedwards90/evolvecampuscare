import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES_PER_REQUEST = 10;
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
];

export interface RequestAttachment {
  id: string;
  request_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
  uploader_name?: string | null;
}

export function useRequestAttachments(requestId: string | undefined) {
  return useQuery({
    queryKey: ['request-attachments', requestId],
    enabled: !!requestId,
    queryFn: async (): Promise<RequestAttachment[]> => {
      const { data, error } = await supabase
        .from('request_attachments')
        .select('*')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch uploader names (best-effort)
      const ids = Array.from(new Set((data ?? []).map((a) => a.uploaded_by)));
      let names: Record<string, string | null> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', ids);
        names = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.full_name]));
      }
      return (data ?? []).map((a) => ({ ...a, uploader_name: names[a.uploaded_by] ?? null }));
    },
  });
}

export function useUploadAttachment(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`"${file.name}" is larger than 10 MB.`);
      }
      if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(`"${file.name}" has an unsupported file type.`);
      }
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error('Not signed in');

      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${requestId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from('request-attachments')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('request_attachments').insert({
        request_id: requestId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: userData.user.id,
      });
      if (insErr) {
        // Try to roll back the storage object
        await supabase.storage.from('request-attachments').remove([path]);
        throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request-attachments', requestId] });
      toast.success('File uploaded');
    },
    onError: (e: Error) => toast.error(e.message || 'Upload failed'),
  });
}

export function useDeleteAttachment(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (att: RequestAttachment) => {
      const { error: delObjErr } = await supabase.storage
        .from('request-attachments')
        .remove([att.file_path]);
      if (delObjErr) throw delObjErr;
      const { error } = await supabase.from('request_attachments').delete().eq('id', att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request-attachments', requestId] });
      toast.success('File removed');
    },
    onError: (e: Error) => toast.error(e.message || 'Delete failed'),
  });
}

export async function getAttachmentSignedUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('request-attachments')
    .createSignedUrl(filePath, 60 * 5);
  if (error) return null;
  return data?.signedUrl ?? null;
}
