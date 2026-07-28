import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

export interface ReportAISummaryPayload {
  reportType: 'organization' | 'caseload' | 'student';
  scopeLabel: string;
  range: { from: string; to: string };
  summary: Record<string, number | string | null>;
  lifeSkills?: Array<{
    module: string;
    preAvg: number | null;
    postAvg: number | null;
    delta: number | null;
    n: number;
  }>;
  impactHighlights?: Record<string, number | string | null>;
  risks?: Array<{ key: string; label: string; severity: string; detail: string }>;
  actionItems?: Array<{ key: string; severity: string; text: string }>;
  caseNotes?: unknown;
  financials?: unknown;
}

interface AISummaryResult {
  headline: string;
  trends: string;
  improvements: string;
  risk_areas: string;
  next_steps: string;
  generated_at: string;
  model: string | null;
}

interface Props {
  buildPayload: () => ReportAISummaryPayload | null;
  disabled?: boolean;
}

export function ReportAISummary({ buildPayload, disabled }: Props) {
  const [result, setResult] = useState<AISummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    const payload = buildPayload();
    if (!payload) {
      setError('Report is not ready yet.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('report-ai-summary', {
        body: payload,
      });
      if (error) throw error;
      setResult(data as AISummaryResult);
    } catch (e) {
      const msg = (e as Error).message || 'AI summary failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            AI report summary
            <Badge variant="outline" className="rounded-full text-[10px]">
              AI-generated
            </Badge>
          </CardTitle>
          <CardDescription>
            Grounded in the numbers on this page. No fabricated facts — sections
            with no supporting data will say so.
          </CardDescription>
        </div>
        <Button onClick={generate} disabled={loading || disabled} className="shrink-0">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {result ? 'Regenerate' : 'Generate AI summary'}
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>AI summary failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!result && !error && !loading && (
          <div className="flex items-start gap-2 rounded-lg border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4" />
            <span>
              Click <strong>Generate AI summary</strong> to produce a narrative
              trends / improvements / risk areas / next steps view derived from
              the report metrics above.
            </span>
          </div>
        )}

        {result && (
          <div className="space-y-4 text-sm">
            <p className="rounded-lg bg-muted/50 p-3 font-medium leading-relaxed">
              {result.headline}
            </p>
            <Section title="Trends" text={result.trends} />
            <Section title="Improvements" text={result.improvements} />
            <Section title="Risk areas" text={result.risk_areas} />
            <Section title="Recommended next steps" text={result.next_steps} />
            <p className="text-[11px] text-muted-foreground">
              Generated {new Date(result.generated_at).toLocaleString()}
              {result.model ? ` · ${result.model}` : ''}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <p className="leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}
