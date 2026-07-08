import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileText, Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import { useSurveyImpact } from '@/hooks/useSurveyImpact';
import type { CompletionSource } from '@/hooks/useSurveyCompletions';
import { exportSurveyImpactCsv, exportSurveyImpactPdf } from '@/lib/surveyImpactExport';
import { toast } from '@/hooks/use-toast';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import { LIFESKILLS_MODULES, preSlug, postSlug, LIFESKILLS_FINAL_SLUG, FINAL_TEMPLATE } from '@/lib/lifeskillsTemplates';

interface SurveyOption {
  value: CompletionSource;
  label: string;
  group: string;
}

const BASE_OPTIONS: SurveyOption[] = [
  { value: 'checkin', label: 'Weekly Check-In', group: 'Core' },
  { value: 'post_grad', label: '12-Month Post-Graduation Plan', group: 'Core' },
  { value: 'intake', label: 'Student Intake Survey', group: 'Onboarding' },
  { value: 'career_intake', label: 'Career Intake Survey', group: 'Onboarding' },
];

function lifeskillsOptions(): SurveyOption[] {
  const list: SurveyOption[] = [];
  list.push({ value: 'impact:lifeskills-all' as CompletionSource, label: 'All modules — Pre vs Post summary', group: 'Life Skills' });
  for (const m of LIFESKILLS_MODULES) {
    const tag = `M${String(m.number).padStart(2, '0')} · ${m.title}`;
    list.push({
      value: `impact:lifeskills-module:${m.id}` as CompletionSource,
      label: `${tag} — Before vs After`,
      group: 'Life Skills',
    });
  }
  list.push({ value: `impact:${LIFESKILLS_FINAL_SLUG}` as CompletionSource, label: FINAL_TEMPLATE.title, group: 'Life Skills' });
  return list;
}
// Reference retained to avoid unused-import churn; slugs still used elsewhere.
void preSlug; void postSlug;


const ALL_OPTIONS: SurveyOption[] = [...BASE_OPTIONS, ...lifeskillsOptions()];

type Preset = '7d' | '30d' | '90d' | 'ytd' | 'custom';

function rangeFor(preset: Preset, from?: string, to?: string): { from: Date; to: Date } {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  if (preset === '7d') return { from: subDays(end, 6), to: end };
  if (preset === '30d') return { from: subDays(end, 29), to: end };
  if (preset === '90d') return { from: subDays(end, 89), to: end };
  if (preset === 'ytd') return { from: new Date(today.getFullYear(), 0, 1), to: end };
  return {
    from: from ? new Date(from) : subDays(end, 29),
    to: to ? new Date(`${to}T23:59:59`) : end,
  };
}

export default function SurveyImpactReports() {
  const [searchParams] = useSearchParams();
  const initial = (searchParams.get('survey') as CompletionSource) || 'checkin';
  const [survey, setSurvey] = useState<CompletionSource>(initial);
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const { data, isLoading, isFetching } = useSurveyImpact({ source: survey, from: range.from, to: range.to });

  const surveyTitle = ALL_OPTIONS.find((o) => o.value === survey)?.label || 'Survey';

  const handleCsv = () => {
    if (!data) return;
    try { exportSurveyImpactCsv(surveyTitle, data, range); }
    catch (e) { toast({ title: 'CSV export failed', description: (e as Error).message, variant: 'destructive' }); }
  };
  const handlePdf = () => {
    if (!data) return;
    try { exportSurveyImpactPdf(surveyTitle, data, range); }
    catch (e) { toast({ title: 'PDF export failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  const groups = Array.from(new Set(ALL_OPTIONS.map((o) => o.group)));

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader
          title="Survey Impact Reports"
          description="Summaries of how students are responding across every survey on the platform. Filter, view, and export."
        />

        <GlobalFilterBar visible={['organizationId', 'cohort', 'yearOfStudy', 'assignedCaseManagerId']} />

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Report options</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Survey</label>
                <Select value={survey} onValueChange={(v) => setSurvey(v as CompletionSource)}>
                  <SelectTrigger className="w-[340px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {groups.map((g) => (
                      <div key={g}>
                        <div className="px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground">{g}</div>
                        {ALL_OPTIONS.filter((o) => o.group === g).map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Range</label>
                <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="ytd">Year to date</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {preset === 'custom' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">From</label>
                    <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[160px]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">To</label>
                    <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[160px]" />
                  </div>
                </>
              )}

              <div className="ml-auto flex items-center gap-2">
                {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Button variant="outline" onClick={handleCsv} disabled={!data}>
                  <FileText className="mr-2 h-4 w-4" /> CSV
                </Button>
                <Button onClick={handlePdf} disabled={!data}>
                  <Download className="mr-2 h-4 w-4" /> PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading impact data…
          </div>
        ) : !data || data.totalResponses === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No responses in the selected range and filters.</CardContent></Card>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Total responses" value={data.totalResponses} />
              <Stat label="Unique respondents" value={data.uniqueRespondents} />
              <Stat label="First submission" value={data.firstAt ? format(new Date(data.firstAt), 'PP') : '—'} />
              <Stat label="Last submission" value={data.lastAt ? format(new Date(data.lastAt), 'PP') : '—'} />
            </div>

            {Object.keys(data.metrics).length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Key metrics</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(data.metrics).map(([k, v]) => <Stat key={k} label={k} value={v ?? '—'} />)}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Submission volume</CardTitle>
                <CardDescription>Responses per day across the selected range.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.volumeByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {data.distributions.map((d) => {
              const series = d.series && d.series.length ? d.series : [{ key: 'value', label: 'Count' }];
              const palette = ['hsl(var(--muted-foreground))', 'hsl(var(--primary))', 'hsl(var(--accent))'];
              const isAvgChart = d.title.toLowerCase().includes('confidence');
              return (
                <Card key={d.title}>
                  <CardHeader><CardTitle className="text-base">{d.title}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={d.data}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals domain={isAvgChart ? [0, 5] : undefined as any} />
                          <Tooltip />
                          {series.length > 1 && <Legend />}
                          {series.map((s, i) => (
                            <Bar key={s.key} dataKey={s.key} name={s.label} fill={palette[i % palette.length]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {data.textHighlights.map((t) => {
              if (t.extraColumns && t.extraColumns.length) {
                return (
                  <Card key={t.title}>
                    <CardHeader><CardTitle className="text-base">{t.title}</CardTitle></CardHeader>
                    <CardContent className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="py-2 pr-4 font-medium">Module</th>
                            {t.extraColumns.map((c) => (
                              <th key={c} className="py-2 px-3 font-medium tabular-nums">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {t.items.map((i) => (
                            <tr key={i.text} className="border-b border-border/40">
                              <td className="py-2 pr-4">{i.text}</td>
                              {t.extraColumns!.map((c) => (
                                <td key={c} className="py-2 px-3 tabular-nums text-muted-foreground">{(i.extra?.[c] as any) ?? '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                );
              }
              return (
                <Card key={t.title}>
                  <CardHeader><CardTitle className="text-base">{t.title}</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm">
                      {t.items.map((i) => (
                        <li key={i.text} className="flex justify-between gap-4 border-b border-border/40 py-1">
                          <span className="truncate">{i.text}</span>
                          <span className="text-muted-foreground tabular-nums">{i.count}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}


          </div>
        )}
      </div>
    </SidebarLayout>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
