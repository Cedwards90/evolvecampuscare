import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CaseNoteRow {
  id: string;
  student_id: string;
  author_id: string;
  content: string;
  note_type: string;
  title: string | null;
  contact_date: string | null;
  contact_type: string | null;
  duration_minutes: number | null;
  identified_needs: number[];
  referral_agency: string | null;
  referral_contact: string | null;
  next_steps: string | null;
  created_at: string;
  student_name?: string | null;
  author_name?: string | null;
}

export interface CaseNotesGroup {
  key: string;
  label: string;
  count: number;
  totalMinutes: number;
  rows: CaseNoteRow[];
}

export interface CaseNotesSummary {
  total: number;
  totalMinutes: number;
  byCategory: CaseNotesGroup[];
  byContactType: CaseNotesGroup[];
  byStudent: CaseNotesGroup[];
  byAuthor: CaseNotesGroup[];
  rows: CaseNoteRow[];
}

interface Params {
  /** Restrict by student IDs (org report). Leave empty to skip this filter. */
  studentIds?: string[];
  /** Restrict by author (caseload report). */
  authorId?: string;
  from: Date;
  to: Date;
  enabled?: boolean;
}

const EMPTY: CaseNotesSummary = {
  total: 0,
  totalMinutes: 0,
  byCategory: [],
  byContactType: [],
  byStudent: [],
  byAuthor: [],
  rows: [],
};

function group(
  rows: CaseNoteRow[],
  keyOf: (r: CaseNoteRow) => string | null,
  labelOf: (r: CaseNoteRow) => string,
): CaseNotesGroup[] {
  const map = new Map<string, CaseNotesGroup>();
  for (const r of rows) {
    const k = keyOf(r) ?? '__none__';
    let g = map.get(k);
    if (!g) {
      g = { key: k, label: labelOf(r), count: 0, totalMinutes: 0, rows: [] };
      map.set(k, g);
    }
    g.count += 1;
    g.totalMinutes += r.duration_minutes || 0;
    g.rows.push(r);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function useCaseNotesSummary({
  studentIds,
  authorId,
  from,
  to,
  enabled = true,
}: Params) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const idsKey = (studentIds ?? []).slice().sort().join(',');

  return useQuery<CaseNotesSummary>({
    queryKey: ['case-notes-summary', authorId ?? null, idsKey, fromIso, toIso],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async () => {
      // Nothing to query for org-report scope with zero students
      if (studentIds && studentIds.length === 0 && !authorId) return EMPTY;

      let q = supabase
        .from('file_notes')
        .select(
          'id, student_id, author_id, content, note_type, title, contact_date, contact_type, duration_minutes, identified_needs, referral_agency, referral_contact, next_steps, created_at',
        )
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false });

      if (authorId) q = q.eq('author_id', authorId);
      if (studentIds && studentIds.length > 0) q = q.in('student_id', studentIds);

      const { data: notesData, error } = await q;
      if (error) throw error;
      const notes = (notesData || []) as CaseNoteRow[];
      if (notes.length === 0) return EMPTY;

      // Hydrate names (best-effort; RLS decides visibility)
      const sIds = Array.from(new Set(notes.map((n) => n.student_id)));
      const aIds = Array.from(new Set(notes.map((n) => n.author_id)));
      const [sRes, aRes] = await Promise.all([
        sIds.length
          ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', sIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        aIds.length
          ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', aIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);
      const nameMap = new Map<string, string>();
      [...(sRes.data || []), ...(aRes.data || [])].forEach((p: any) => {
        nameMap.set(p.user_id, p.full_name || p.email || 'Unknown');
      });

      const hydrated: CaseNoteRow[] = notes.map((n) => ({
        ...n,
        student_name: nameMap.get(n.student_id) || null,
        author_name: nameMap.get(n.author_id) || null,
      }));

      const totalMinutes = hydrated.reduce((s, r) => s + (r.duration_minutes || 0), 0);

      return {
        total: hydrated.length,
        totalMinutes,
        byCategory: group(
          hydrated,
          (r) => r.note_type || 'case_note',
          (r) => r.note_type || 'case_note',
        ),
        byContactType: group(
          hydrated,
          (r) => r.contact_type || null,
          (r) => r.contact_type || 'Unspecified',
        ),
        byStudent: group(
          hydrated,
          (r) => r.student_id,
          (r) => r.student_name || 'Unknown student',
        ),
        byAuthor: group(
          hydrated,
          (r) => r.author_id,
          (r) => r.author_name || 'Unknown',
        ),
        rows: hydrated,
      };
    },
  });
}
