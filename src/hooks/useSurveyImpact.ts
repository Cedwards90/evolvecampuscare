import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import type { CompletionSource } from '@/hooks/useSurveyCompletions';

export interface SurveyImpactRow {
  id: string;
  student_id: string;
  full_name: string | null;
  email: string | null;
  organization_id: string | null;
  organization_name: string | null;
  cohort_id: string | null;
  year_of_study: string | null;
  ts: string; // submission timestamp
  data: any; // raw payload
}

export interface SurveyImpactResult {
  rows: SurveyImpactRow[];
  totalResponses: number;
  uniqueRespondents: number;
  firstAt: string | null;
  lastAt: string | null;
  /** Volume by ISO date (YYYY-MM-DD). */
  volumeByDay: { date: string; count: number }[];
  /** Aggregates specific to source. */
  metrics: Record<string, number | string | null>;
  /** Distribution charts for the source. Optional `series` enables grouped bars. */
  distributions: {
    title: string;
    data: { name: string; value?: number; [k: string]: any }[];
    series?: { key: string; label: string }[];
  }[];
  /** Top free-text items (for surveys with open fields). */
  textHighlights: {
    title: string;
    items: { text: string; count: number; extra?: Record<string, string | number> }[];
    extraColumns?: string[];
  }[];
}


interface Args {
  source: CompletionSource | null;
  from: Date;
  to: Date;
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function buildVolume(rows: SurveyImpactRow[]): { date: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(r.ts);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
}

function countBy<T>(rows: T[], pick: (r: T) => string | string[] | null | undefined) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const v = pick(r);
    const arr = Array.isArray(v) ? v : v ? [v] : [];
    for (const item of arr) {
      const k = (item || '').toString().trim();
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + 1);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
}

async function loadProfiles(studentIds: string[]) {
  if (studentIds.length === 0) return { profMap: new Map(), orgMap: new Map<string, string>() };
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, organization_id, cohort_id, year_of_study')
    .in('user_id', studentIds);
  const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  const orgIds = [...new Set((profiles || []).map((p: any) => p.organization_id).filter(Boolean))];
  const orgMap = new Map<string, string>();
  if (orgIds.length) {
    const { data: orgs } = await supabase
      .from('training_organizations')
      .select('id, name')
      .in('id', orgIds as string[]);
    for (const o of orgs || []) orgMap.set((o as any).id, (o as any).name);
  }
  return { profMap, orgMap };
}

async function fetchSource(source: CompletionSource, from: Date, to: Date): Promise<{ id: string; student_id: string; ts: string; data: any }[]> {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  if (source === 'checkin') {
    const { data, error } = await supabase
      .from('student_checkins')
      .select('*')
      .gte('created_at', fromIso)
      .lte('created_at', toIso);
    if (error) throw error;
    return (data || []).map((r: any) => ({ id: r.id, student_id: r.student_id, ts: r.created_at, data: r }));
  }
  if (source === 'post_grad') {
    const { data, error } = await supabase
      .from('post_graduation_plans')
      .select('*')
      .gte('updated_at', fromIso)
      .lte('updated_at', toIso);
    if (error) throw error;
    return (data || []).map((r: any) => ({ id: r.id, student_id: r.student_id, ts: r.updated_at || r.created_at, data: r }));
  }
  if (source === 'intake') {
    const { data, error } = await supabase
      .from('intake_responses')
      .select('*')
      .gte('updated_at', fromIso)
      .lte('updated_at', toIso);
    if (error) throw error;
    return (data || []).map((r: any) => ({ id: r.id, student_id: r.student_id, ts: r.updated_at || r.created_at, data: r }));
  }
  if (source === 'career_intake') {
    const { data, error } = await supabase
      .from('career_intake_responses')
      .select('*')
      .gte('updated_at', fromIso)
      .lte('updated_at', toIso);
    if (error) throw error;
    return (data || []).map((r: any) => ({ id: r.id, student_id: r.student_id, ts: r.updated_at || r.created_at, data: r }));
  }
  if (source === 'impact:lifeskills-all') {
    const { data, error } = await supabase
      .from('impact_survey_responses')
      .select('*, impact_survey_templates!inner(slug)')
      .like('impact_survey_templates.slug', 'lifeskills-m%')
      .gte('submitted_at', fromIso)
      .lte('submitted_at', toIso);
    if (error) throw error;
    return (data || [])
      .filter((r: any) => /^lifeskills-m\d{2}-(pre|post)$/.test(r.impact_survey_templates?.slug || ''))
      .map((r: any) => ({
        id: r.id,
        student_id: r.student_id,
        ts: r.submitted_at,
        data: { ...r, _slug: r.impact_survey_templates?.slug as string },
      }));
  }
  if (source.startsWith('impact:')) {
    const slug = source.slice('impact:'.length);
    const { data: tpl } = await supabase
      .from('impact_survey_templates')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!tpl) return [];
    const { data, error } = await supabase
      .from('impact_survey_responses')
      .select('*')
      .eq('template_id', (tpl as any).id)
      .gte('submitted_at', fromIso)
      .lte('submitted_at', toIso);
    if (error) throw error;
    return (data || []).map((r: any) => ({ id: r.id, student_id: r.student_id, ts: r.submitted_at, data: r }));
  }
  return [];
}


function computeSourceMetrics(source: CompletionSource, rows: SurveyImpactRow[]): {
  metrics: Record<string, number | string | null>;
  distributions: { title: string; data: { name: string; value: number }[] }[];
  textHighlights: { title: string; items: { text: string; count: number }[] }[];
} {
  const metrics: Record<string, number | string | null> = {};
  const distributions: { title: string; data: { name: string; value: number }[] }[] = [];
  const textHighlights: { title: string; items: { text: string; count: number }[] }[] = [];

  if (source === 'checkin') {
    const moods = rows.map((r) => Number(r.data.mood_rating)).filter((n) => Number.isFinite(n));
    const progress = rows.map((r) => Number(r.data.progress_rating)).filter((n) => Number.isFinite(n));
    metrics['Avg mood (1–5)'] = moods.length ? +(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(2) : null;
    metrics['Avg progress (1–5)'] = progress.length ? +(progress.reduce((a, b) => a + b, 0) / progress.length).toFixed(2) : null;
    metrics['Wins logged'] = rows.filter((r) => (r.data.wins || '').toString().trim().length > 0).length;
    metrics['Blockers logged'] = rows.filter((r) => (r.data.blockers || '').toString().trim().length > 0).length;
    distributions.push({
      title: 'Mood distribution',
      data: [1, 2, 3, 4, 5].map((n) => ({ name: `${n}`, value: moods.filter((m) => m === n).length })),
    });
    distributions.push({
      title: 'Progress distribution',
      data: [1, 2, 3, 4, 5].map((n) => ({ name: `${n}`, value: progress.filter((m) => m === n).length })),
    });
  }

  if (source === 'post_grad') {
    const fields = ['career_goals', 'education_goals', 'housing_plan', 'financial_plan', 'health_wellness', 'support_needed'];
    distributions.push({
      title: 'Section completion rate',
      data: fields.map((f) => ({
        name: f.replace(/_/g, ' '),
        value: rows.filter((r) => (r.data[f] || '').toString().trim().length > 0).length,
      })),
    });
    const filled = rows.filter((r) => fields.every((f) => (r.data[f] || '').toString().trim().length > 0)).length;
    metrics['Fully completed plans'] = filled;
    metrics['Completion rate'] = rows.length ? `${Math.round((filled / rows.length) * 100)}%` : '0%';
  }

  if (source === 'intake') {
    distributions.push({
      title: 'Responses by section',
      data: countBy(rows, (r) => r.data.section),
    });
    metrics['Sections covered'] = new Set(rows.map((r) => r.data.section).filter(Boolean)).size;
  }

  if (source === 'career_intake') {
    metrics['Have computer access'] = rows.filter((r) => r.data.has_computer_access).length;
    const skill = countBy(rows, (r) => r.data.internet_skill_level);
    if (skill.length) distributions.push({ title: 'Internet skill level', data: skill });
    const availability = countBy(rows, (r) => r.data.availability);
    if (availability.length) distributions.push({ title: 'Availability', data: availability });
    const strengths = countBy(rows, (r) => r.data.strengths_skills);
    if (strengths.length) textHighlights.push({ title: 'Top strengths/skills', items: strengths.slice(0, 10).map((s) => ({ text: s.name, count: s.value })) });
    const dreams = rows.map((r) => (r.data.dream_career || '').toString().trim()).filter(Boolean);
    if (dreams.length) {
      const counts = new Map<string, number>();
      for (const d of dreams) counts.set(d, (counts.get(d) || 0) + 1);
      textHighlights.push({
        title: 'Dream careers (most cited)',
        items: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([text, count]) => ({ text, count })),
      });
    }
  }

  if (source === 'impact:lifeskills-all') {
    // Group by module → pre/post
    const { LIFESKILLS_MODULES } = require('@/lib/lifeskillsTemplates');
    type Acc = { preSum: number; preN: number; postSum: number; postN: number; preByStu: Map<string, number>; postByStu: Map<string, number> };
    const byMod = new Map<string, Acc>();
    for (const m of LIFESKILLS_MODULES) byMod.set(m.id, { preSum: 0, preN: 0, postSum: 0, postN: 0, preByStu: new Map(), postByStu: new Map() });
    for (const r of rows) {
      const slug: string = r.data?._slug || '';
      const match = slug.match(/^lifeskills-(m\d{2})-(pre|post)$/);
      if (!match) continue;
      const acc = byMod.get(match[1]);
      if (!acc) continue;
      const conf = Number(r.data?.score_summary?.confidence);
      if (!Number.isFinite(conf)) continue;
      if (match[2] === 'pre') { acc.preSum += conf; acc.preN += 1; acc.preByStu.set(r.student_id, conf); }
      else { acc.postSum += conf; acc.postN += 1; acc.postByStu.set(r.student_id, conf); }
    }
    const moduleRows = LIFESKILLS_MODULES.map((m: any) => {
      const a = byMod.get(m.id)!;
      const preAvg = a.preN ? a.preSum / a.preN : null;
      const postAvg = a.postN ? a.postSum / a.postN : null;
      const delta = preAvg != null && postAvg != null ? postAvg - preAvg : null;
      let pairedN = 0; let pairedDeltaSum = 0;
      for (const [sid, pre] of a.preByStu) {
        const post = a.postByStu.get(sid);
        if (post != null) { pairedN += 1; pairedDeltaSum += post - pre; }
      }
      const pairedAvgDelta = pairedN ? pairedDeltaSum / pairedN : null;
      return {
        id: m.id,
        name: `M${String(m.number).padStart(2, '0')} ${m.title}`,
        short: `M${String(m.number).padStart(2, '0')}`,
        preAvg, postAvg, delta, preN: a.preN, postN: a.postN, pairedN, pairedAvgDelta,
      };
    });

    // Grouped bar: Pre vs Post per module
    distributions.push({
      title: 'Average confidence by module (Pre vs Post)',
      series: [{ key: 'pre', label: 'Pre' }, { key: 'post', label: 'Post' }],
      data: moduleRows.map((r: any) => ({
        name: r.short,
        pre: r.preAvg != null ? +r.preAvg.toFixed(2) : 0,
        post: r.postAvg != null ? +r.postAvg.toFixed(2) : 0,
      })),
    });
    // Delta bar
    distributions.push({
      title: 'Confidence gain by module (Post − Pre)',
      data: moduleRows.map((r: any) => ({
        name: r.short,
        value: r.delta != null ? +r.delta.toFixed(2) : 0,
      })),
    });

    // Per-module summary table via textHighlights
    textHighlights.push({
      title: 'Module impact summary',
      extraColumns: ['Pre avg', 'Pre n', 'Post avg', 'Post n', 'Δ', 'Paired n', 'Paired Δ'],
      items: moduleRows.map((r: any) => ({
        text: r.name,
        count: r.preN + r.postN,
        extra: {
          'Pre avg': r.preAvg != null ? r.preAvg.toFixed(2) : '—',
          'Pre n': r.preN,
          'Post avg': r.postAvg != null ? r.postAvg.toFixed(2) : '—',
          'Post n': r.postN,
          'Δ': r.delta != null ? (r.delta >= 0 ? `+${r.delta.toFixed(2)}` : r.delta.toFixed(2)) : '—',
          'Paired n': r.pairedN,
          'Paired Δ': r.pairedAvgDelta != null ? (r.pairedAvgDelta >= 0 ? `+${r.pairedAvgDelta.toFixed(2)}` : r.pairedAvgDelta.toFixed(2)) : '—',
        },
      })),
    });

    // Top-level metrics
    const modsWithBoth = moduleRows.filter((r: any) => r.preAvg != null && r.postAvg != null);
    const allPre = moduleRows.flatMap((r: any) => r.preAvg != null ? [{ avg: r.preAvg, n: r.preN }] : []);
    const allPost = moduleRows.flatMap((r: any) => r.postAvg != null ? [{ avg: r.postAvg, n: r.postN }] : []);
    const weighted = (arr: { avg: number; n: number }[]) => {
      const totalN = arr.reduce((s, x) => s + x.n, 0);
      return totalN ? arr.reduce((s, x) => s + x.avg * x.n, 0) / totalN : null;
    };
    const preW = weighted(allPre);
    const postW = weighted(allPost);
    metrics['Modules with pre+post data'] = `${modsWithBoth.length} / ${moduleRows.length}`;
    metrics['Avg pre confidence (1–5)'] = preW != null ? +preW.toFixed(2) : null;
    metrics['Avg post confidence (1–5)'] = postW != null ? +postW.toFixed(2) : null;
    metrics['Avg gain (Post − Pre)'] = preW != null && postW != null ? +(postW - preW).toFixed(2) : null;
    const totalPaired = moduleRows.reduce((s: number, r: any) => s + r.pairedN, 0);
    metrics['Paired pre/post responses'] = totalPaired;
  } else if (source.startsWith('impact:')) {
    const summaries = rows.map((r) => r.data.score_summary || {});
    const confidences = summaries.map((s: any) => Number(s.confidence)).filter((n) => Number.isFinite(n));
    if (confidences.length) {
      metrics['Avg confidence (1–5)'] = +(confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(2);
      distributions.push({
        title: 'Confidence distribution',
        data: [1, 2, 3, 4, 5].map((n) => ({ name: `${n}`, value: confidences.filter((c) => Math.round(c) === n).length })),
      });
    }
    const npsVals = summaries.map((s: any) => Number(s.nps)).filter((n) => Number.isFinite(n));
    if (npsVals.length) {
      const avg = npsVals.reduce((a, b) => a + b, 0) / npsVals.length;
      metrics['Avg NPS (0–10)'] = +avg.toFixed(2);
      const promoters = npsVals.filter((n) => n >= 9).length;
      const detractors = npsVals.filter((n) => n <= 6).length;
      metrics['NPS score'] = Math.round(((promoters - detractors) / npsVals.length) * 100);
    }
  }


  return { metrics, distributions, textHighlights };
}

export function useSurveyImpact({ source, from, to }: Args) {
  const { filters } = useGlobalFilters();
  const filterKey = JSON.stringify({
    o: filters.organizationId, c: filters.cohort, y: filters.yearOfStudy, cm: filters.assignedCaseManagerId,
  });

  return useQuery({
    queryKey: ['survey-impact', source, from.toISOString(), to.toISOString(), filterKey],
    enabled: !!source,
    queryFn: async (): Promise<SurveyImpactResult> => {
      const raw = await fetchSource(source!, from, to);
      const studentIds = [...new Set(raw.map((r) => r.student_id))];
      const { profMap, orgMap } = await loadProfiles(studentIds);

      // Optional CM scope filter
      let cmStudentSet: Set<string> | null = null;
      if (filters.assignedCaseManagerId.length) {
        const { data: assigns } = await supabase
          .from('student_assignments')
          .select('student_id, case_manager_id')
          .in('case_manager_id', filters.assignedCaseManagerId);
        cmStudentSet = new Set((assigns || []).map((a: any) => a.student_id));
      }

      const rows: SurveyImpactRow[] = raw
        .map((r) => {
          const p: any = profMap.get(r.student_id) || {};
          return {
            id: r.id,
            student_id: r.student_id,
            full_name: p.full_name || null,
            email: p.email || null,
            organization_id: p.organization_id || null,
            organization_name: p.organization_id ? orgMap.get(p.organization_id) || null : null,
            cohort_id: p.cohort_id || null,
            year_of_study: p.year_of_study || null,
            ts: r.ts,
            data: r.data,
          };
        })
        .filter((r) => {
          if (filters.organizationId.length && (!r.organization_id || !filters.organizationId.includes(r.organization_id))) return false;
          if (filters.cohort.length && (!r.cohort_id || !filters.cohort.includes(r.cohort_id))) return false;
          if (filters.yearOfStudy.length && (!r.year_of_study || !filters.yearOfStudy.includes(r.year_of_study))) return false;
          if (cmStudentSet && !cmStudentSet.has(r.student_id)) return false;
          return true;
        })
        .sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));

      const totalResponses = rows.length;
      const uniqueRespondents = new Set(rows.map((r) => r.student_id)).size;
      const sortedTs = rows.map((r) => r.ts).filter(Boolean).sort();
      const firstAt = sortedTs[0] || null;
      const lastAt = sortedTs[sortedTs.length - 1] || null;

      const { metrics, distributions, textHighlights } = computeSourceMetrics(source!, rows);

      return {
        rows,
        totalResponses,
        uniqueRespondents,
        firstAt,
        lastAt,
        volumeByDay: buildVolume(rows),
        metrics,
        distributions,
        textHighlights,
      };
    },
  });
}
