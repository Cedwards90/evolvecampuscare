/**
 * Life Skills progress aggregator.
 *
 * Given a set of student IDs, returns average pre/post confidence per module
 * plus the final wrap-up NPS — all sourced from `impact_survey_responses`
 * joined to `impact_survey_templates` where the slug matches the
 * `lifeskills-*` naming convention. No fabrication: if a module has zero
 * responses in the scope, its `n` is 0 and its `pre`/`post` are `null`.
 *
 * Used by:
 *   - Per-student report (single studentId)
 *   - Per-CM report (studentIds = assigned caseload)
 *   - Org report (studentIds = filtered org pool)
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  LIFESKILLS_MODULES,
  LIFESKILLS_FINAL_SLUG,
  preSlug,
  postSlug,
  type LifeSkillsModule,
} from '@/lib/lifeskillsTemplates';

export interface LifeSkillsModuleStat {
  module: LifeSkillsModule;
  preSlug: string;
  postSlug: string;
  preAvg: number | null;
  postAvg: number | null;
  preN: number;
  postN: number;
  delta: number | null; // postAvg - preAvg (null when either side is empty)
}

export interface LifeSkillsProgressResult {
  modules: LifeSkillsModuleStat[];
  finalNps: { avg: number | null; n: number };
  totalResponses: number;
  hasAnyData: boolean;
}

export function emptyLifeSkillsResult(): LifeSkillsProgressResult {
  return {
    modules: LIFESKILLS_MODULES.map((m) => ({
      module: m,
      preSlug: preSlug(m.id),
      postSlug: postSlug(m.id),
      preAvg: null,
      postAvg: null,
      preN: 0,
      postN: 0,
      delta: null,
    })),
    finalNps: { avg: null, n: 0 },
    totalResponses: 0,
    hasAnyData: false,
  };
}

interface Params {
  studentIds: string[] | undefined;
  /** Optional: restrict responses to this window (defaults to all-time). */
  from?: Date;
  to?: Date;
}

export function computeLifeSkillsProgress(
  rows: Array<{ slug: string; score: Record<string, unknown> | null }>,
): LifeSkillsProgressResult {
  const buckets = new Map<string, { sum: number; n: number }>();
  let npsSum = 0;
  let npsN = 0;

  for (const row of rows) {
    const slug = row.slug;
    const s = row.score || {};
    if (slug === LIFESKILLS_FINAL_SLUG) {
      const v = Number((s as { nps?: unknown }).nps);
      if (Number.isFinite(v)) {
        npsSum += v;
        npsN += 1;
      }
      continue;
    }
    if (!slug?.startsWith?.('lifeskills-')) continue;
    const conf = Number((s as { confidence?: unknown }).confidence);
    if (!Number.isFinite(conf)) continue;
    const cur = buckets.get(slug) || { sum: 0, n: 0 };
    cur.sum += conf;
    cur.n += 1;
    buckets.set(slug, cur);
  }

  const modules: LifeSkillsModuleStat[] = LIFESKILLS_MODULES.map((m) => {
    const pre = buckets.get(preSlug(m.id));
    const post = buckets.get(postSlug(m.id));
    const preAvg = pre && pre.n > 0 ? pre.sum / pre.n : null;
    const postAvg = post && post.n > 0 ? post.sum / post.n : null;
    return {
      module: m,
      preSlug: preSlug(m.id),
      postSlug: postSlug(m.id),
      preAvg,
      postAvg,
      preN: pre?.n ?? 0,
      postN: post?.n ?? 0,
      delta: preAvg != null && postAvg != null ? postAvg - preAvg : null,
    };
  });

  const totalResponses = rows.length;
  const hasAnyData = totalResponses > 0;
  return { modules, finalNps: { avg: npsN > 0 ? npsSum / npsN : null, n: npsN }, totalResponses, hasAnyData };
}

export function useLifeSkillsProgress({ studentIds, from, to }: Params) {
  const key = ['lifeskills-progress', studentIds?.slice().sort().join(','), from?.toISOString(), to?.toISOString()];
  return useQuery({
    queryKey: key,
    enabled: !!studentIds,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<LifeSkillsProgressResult> => {
      if (!studentIds || studentIds.length === 0) return emptyLifeSkillsResult();
      let q = supabase
        .from('impact_survey_responses')
        .select('score_summary, submitted_at, impact_survey_templates!inner(slug)')
        .in('student_id', studentIds);
      if (from) q = q.gte('submitted_at', from.toISOString());
      if (to) q = q.lte('submitted_at', to.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      const rows = ((data as unknown as Array<{
        score_summary: Record<string, unknown> | null;
        impact_survey_templates: { slug: string };
      }>) || []).map((r) => ({
        slug: r.impact_survey_templates?.slug,
        score: r.score_summary,
      }));
      return computeLifeSkillsProgress(rows);
    },
  });
}
