import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LIFESKILLS_MODULES, preSlug, postSlug, LIFESKILLS_FINAL_SLUG } from '@/lib/lifeskillsTemplates';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface AggRow { slug: string; avg_confidence: number; count: number; }

export function LifeSkillsImpactCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['lifeskills', 'impact-agg'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('impact_survey_responses')
        .select('score_summary, impact_survey_templates!inner(slug)');
      if (error) throw error;

      const agg = new Map<string, { sum: number; n: number }>();
      let npsSum = 0; let npsN = 0;
      for (const r of (rows || []) as any[]) {
        const slug: string = r.impact_survey_templates?.slug;
        if (!slug?.startsWith('lifeskills-')) continue;
        const s = r.score_summary || {};
        if (slug === LIFESKILLS_FINAL_SLUG) {
          if (typeof s.nps === 'number') { npsSum += s.nps; npsN += 1; }
          continue;
        }
        const v = Number(s.confidence);
        if (Number.isFinite(v)) {
          const cur = agg.get(slug) || { sum: 0, n: 0 };
          cur.sum += v; cur.n += 1;
          agg.set(slug, cur);
        }
      }
      const stats: AggRow[] = [];
      for (const [slug, { sum, n }] of agg) stats.push({ slug, avg_confidence: sum / n, count: n });
      return { stats, nps: npsN > 0 ? npsSum / npsN : null, npsN };
    },
  });

  const chartData = LIFESKILLS_MODULES.map((m) => {
    const pre = data?.stats.find((s) => s.slug === preSlug(m.id));
    const post = data?.stats.find((s) => s.slug === postSlug(m.id));
    return {
      name: `M${String(m.number).padStart(2, '0')}`,
      pre: pre ? Number(pre.avg_confidence.toFixed(2)) : 0,
      post: post ? Number(post.avg_confidence.toFixed(2)) : 0,
      preN: pre?.count ?? 0,
      postN: post?.count ?? 0,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Life Skills Module Impact</CardTitle>
        <CardDescription>
          Average student confidence (1–5) before vs after each module.
          {data?.nps != null && (
            <> · Final NPS: <strong>{data.nps.toFixed(1)}</strong> (n={data.npsN})</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="pre" name="Pre" fill="hsl(var(--muted-foreground))" />
                <Bar dataKey="post" name="Post" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
