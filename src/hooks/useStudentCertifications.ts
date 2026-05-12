import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type CertificationStatus = 'in_progress' | 'completed' | 'expired' | 'revoked';

export interface StudentCertification {
  id: string;
  student_id: string;
  catalog_id: string | null;
  custom_name: string | null;
  issuing_organization: string | null;
  status: CertificationStatus;
  completion_date: string | null;
  expiration_date: string | null;
  credential_id: string | null;
  notes: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertificationInput {
  catalog_id?: string | null;
  custom_name?: string | null;
  issuing_organization?: string | null;
  status: CertificationStatus;
  completion_date?: string | null;
  expiration_date?: string | null;
  credential_id?: string | null;
  notes?: string | null;
  file?: File | null;
  removeFile?: boolean;
}

const BUCKET = 'student-certifications';
export const ALLOWED_CERT_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
export const MAX_CERT_FILE_BYTES = 10 * 1024 * 1024;

export function useStudentCertifications(studentId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['student-certifications', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('student_certifications')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as StudentCertification[];
    },
    enabled: !!studentId,
  });

  async function uploadFile(certId: string, file: File): Promise<{ path: string }> {
    const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
    const path = `${studentId}/${certId}/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    return { path };
  }

  const create = useMutation({
    mutationFn: async (input: CertificationInput) => {
      if (!studentId || !user) throw new Error('Missing context');
      const { file, removeFile, ...rest } = input;
      const { data, error } = await supabase
        .from('student_certifications')
        .insert({
          student_id: studentId,
          catalog_id: rest.catalog_id ?? null,
          custom_name: rest.custom_name?.trim() || null,
          issuing_organization: rest.issuing_organization?.trim() || null,
          status: rest.status,
          completion_date: rest.completion_date || null,
          expiration_date: rest.expiration_date || null,
          credential_id: rest.credential_id?.trim() || null,
          notes: rest.notes?.trim() || null,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (file) {
        const { path } = await uploadFile(data.id, file);
        const { error: upErr } = await supabase
          .from('student_certifications')
          .update({
            file_path: path,
            file_name: file.name,
            mime_type: file.type,
            file_size: file.size,
          })
          .eq('id', data.id);
        if (upErr) throw upErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-certifications', studentId] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, input, existing }: { id: string; input: CertificationInput; existing: StudentCertification }) => {
      const { file, removeFile, ...rest } = input;
      let patch: any = {
        catalog_id: rest.catalog_id ?? null,
        custom_name: rest.custom_name?.trim() || null,
        issuing_organization: rest.issuing_organization?.trim() || null,
        status: rest.status,
        completion_date: rest.completion_date || null,
        expiration_date: rest.expiration_date || null,
        credential_id: rest.credential_id?.trim() || null,
        notes: rest.notes?.trim() || null,
      };

      if (removeFile && existing.file_path) {
        await supabase.storage.from(BUCKET).remove([existing.file_path]);
        patch = { ...patch, file_path: null, file_name: null, mime_type: null, file_size: null };
      }

      if (file) {
        if (existing.file_path) {
          await supabase.storage.from(BUCKET).remove([existing.file_path]);
        }
        const { path } = await uploadFile(id, file);
        patch = {
          ...patch,
          file_path: path,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
        };
      }

      const { error } = await supabase.from('student_certifications').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-certifications', studentId] }),
  });

  const remove = useMutation({
    mutationFn: async (cert: StudentCertification) => {
      if (cert.file_path) {
        await supabase.storage.from(BUCKET).remove([cert.file_path]);
      }
      const { error } = await supabase.from('student_certifications').delete().eq('id', cert.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-certifications', studentId] }),
  });

  async function getSignedUrl(path: string, expiresIn = 60): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  }

  return {
    certifications: list.data ?? [],
    isLoading: list.isLoading,
    create,
    update,
    remove,
    getSignedUrl,
  };
}

export function useExpiringCertifications(days = 90) {
  return useQuery({
    queryKey: ['expiring-certifications', days],
    queryFn: async () => {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + days);
      const { data, error } = await supabase
        .from('student_certifications')
        .select('*')
        .not('expiration_date', 'is', null)
        .gte('expiration_date', now.toISOString().slice(0, 10))
        .lte('expiration_date', future.toISOString().slice(0, 10))
        .neq('status', 'revoked')
        .order('expiration_date', { ascending: true });
      if (error) throw error;
      return (data || []) as StudentCertification[];
    },
  });
}
