import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CompletionSource =
  | 'checkin'
  | 'post_grad'
  | 'intake'
  | 'career_intake'
  | `impact:${string}`;

export interface CompletionRow {
  student_id: string;
  full_name: string | null;
  email: string;
  organization_id: string | null;
  organization_name: string | null;
  count: number;
  last_at: string | null;
}

interface RawRow {
  student_id: string;
  ts: string | null;
}

async function loadRaw(source: CompletionSource): Promise<RawRow[]> {
  if (source === 'checkin') {
    const { data, error } = await supabase
      .from('student_checkins')
      .select('student_id, created_at');
    if (error) throw error;
    return (data || []).map((r: any) => ({ student_id: r.student_id, ts: r.created_at }));
  }
  if (source === 'post_grad') {
    const { data, error } = await supabase
      .from('post_graduation_plans')
      .select('student_id, updated_at, created_at');
    if (error) throw error;
    return (data || []).map((r: any) => ({ student_id: r.student_id, ts: r.updated_at || r.created_at }));
  }
  if (source === 'intake') {
    const { data, error } = await supabase
      .from('intake_responses')
      .select('student_id, updated_at, created_at');
    if (error) throw error;
    return (data || []).map((r: any) => ({ student_id: r.student_id, ts: r.updated_at || r.created_at }));
  }
  if (source === 'career_intake') {
    const { data, error } = await supabase
      .from('career_intake_responses')
      .select('student_id, updated_at, created_at');
    if (error) throw error;
    return (data || []).map((r: any) => ({ student_id: r.student_id, ts: r.updated_at || r.created_at }));
  }
  if (source.startsWith('impact:lifeskills-module:')) {
    const modId = source.slice('impact:lifeskills-module:'.length);
    const preS = `lifeskills-${modId}-pre`;
    const postS = `lifeskills-${modId}-post`;
    const { data: tpls, error: tplErr } = await supabase
      .from('impact_survey_templates')
      .select('id, slug')
      .in('slug', [preS, postS]);
    if (tplErr) throw tplErr;
    const ids = (tpls || []).map((t: any) => t.id);
    if (!ids.length) return [];
    const { data, error } = await supabase
      .from('impact_survey_responses')
      .select('student_id, submitted_at')
      .in('template_id', ids);
    if (error) throw error;
    return (data || []).map((r: any) => ({ student_id: r.student_id, ts: r.submitted_at }));
  }
  if (source.startsWith('impact:')) {
    const slug = source.slice('impact:'.length);
    // Get template id from slug first
    const { data: tpl, error: tplErr } = await supabase
      .from('impact_survey_templates')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (tplErr) throw tplErr;
    if (!tpl) return [];
    const { data, error } = await supabase
      .from('impact_survey_responses')
      .select('student_id, submitted_at')
      .eq('template_id', tpl.id);
    if (error) throw error;
    return (data || []).map((r: any) => ({ student_id: r.student_id, ts: r.submitted_at }));
  }
  return [];
}

export function useSurveyCompletions(source: CompletionSource | null, enabled = true) {
  return useQuery({
    queryKey: ['survey-completions', source],
    enabled: !!source && enabled,
    queryFn: async (): Promise<CompletionRow[]> => {
      const rows = await loadRaw(source!);
      const byStudent = new Map<string, { count: number; last_at: string | null }>();
      for (const r of rows) {
        const prev = byStudent.get(r.student_id);
        if (prev) {
          prev.count += 1;
          if (r.ts && (!prev.last_at || r.ts > prev.last_at)) prev.last_at = r.ts;
        } else {
          byStudent.set(r.student_id, { count: 1, last_at: r.ts });
        }
      }
      const ids = [...byStudent.keys()];
      if (ids.length === 0) return [];
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, organization_id')
        .in('user_id', ids);
      if (profErr) throw profErr;
      const orgIds = [...new Set((profiles || []).map((p: any) => p.organization_id).filter(Boolean))];
      const orgMap = new Map<string, string>();
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase
          .from('training_organizations')
          .select('id, name')
          .in('id', orgIds);
        for (const o of orgs || []) orgMap.set((o as any).id, (o as any).name);
      }
      const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const result: CompletionRow[] = ids.map((sid) => {
        const agg = byStudent.get(sid)!;
        const p = profMap.get(sid) as any;
        return {
          student_id: sid,
          full_name: p?.full_name || null,
          email: p?.email || '',
          organization_id: p?.organization_id || null,
          organization_name: p?.organization_id ? orgMap.get(p.organization_id) || null : null,
          count: agg.count,
          last_at: agg.last_at,
        };
      });
      result.sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''));
      return result;
    },
  });
}
