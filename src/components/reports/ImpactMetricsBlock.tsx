import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Award,
  Briefcase,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  Handshake,
  Info,
  Target,
} from 'lucide-react';

export interface ImpactMetrics {
  scopeLabel: string; // e.g. "This student", "12 students in scope"
  noteBreakdown: Array<{ type: string; count: number }>;
  lastNoteAt: string | null;
  surveys: { sent: number; completed: number; responseRate: number | null };
  certifications: {
    earnedInRange: number;
    active: number;
    expiringSoon: number;
  };
  supportNeeds: {
    openTotal: number;
    byCategory: Array<{ key: string; count: number }>;
    byPriority: Array<{ key: string; count: number }>;
  };
  referrals: {
    createdInRange: number;
    clickedInRange: number;
  };
  milestones: {
    plansOnFile: number;
    graduationsInRange: number;
    stalled: number; // plans not updated in >30d
  };
  engagement: {
    messagesSent: number;
    messagesReceived: number;
    activeDays: number;
  };
  employmentReadiness: {
    employed: number;
    seeking: number;
    unknown: number;
    m05PostAvg: number | null;
  };
}

interface Props {
  metrics: ImpactMetrics;
}

function StatRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
      {hint && <span className="ml-2 text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
  derived,
  empty,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  derived?: boolean;
  empty?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
          {derived && (
            <Badge variant="outline" className="ml-1 rounded-full text-[10px] uppercase">
              derived
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {empty ? (
          <p className="text-xs text-muted-foreground">No data on file.</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function ImpactMetricsBlock({ metrics }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="font-display text-base font-semibold">Expanded impact metrics</h4>
        <p className="text-xs text-muted-foreground">
          {metrics.scopeLabel}. All values are computed from real records — empty sections
          show as “No data on file”.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Section
          icon={<FileText className="h-4 w-4 text-primary" />}
          title="Case notes"
          empty={metrics.noteBreakdown.length === 0 && !metrics.lastNoteAt}
        >
          {metrics.noteBreakdown.map((n) => (
            <StatRow key={n.type} label={n.type} value={n.count} />
          ))}
          {metrics.lastNoteAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Last note: {new Date(metrics.lastNoteAt).toLocaleDateString()}
            </p>
          )}
        </Section>

        <Section
          icon={<ClipboardCheck className="h-4 w-4 text-primary" />}
          title="Surveys"
          empty={metrics.surveys.sent === 0}
        >
          <StatRow label="Sent" value={metrics.surveys.sent} />
          <StatRow label="Completed" value={metrics.surveys.completed} />
          <StatRow
            label="Response rate"
            value={
              metrics.surveys.responseRate == null
                ? '—'
                : `${Math.round(metrics.surveys.responseRate * 100)}%`
            }
          />
        </Section>

        <Section
          icon={<Award className="h-4 w-4 text-primary" />}
          title="Certifications"
          empty={
            metrics.certifications.earnedInRange === 0 &&
            metrics.certifications.active === 0 &&
            metrics.certifications.expiringSoon === 0
          }
        >
          <StatRow label="Earned in range" value={metrics.certifications.earnedInRange} />
          <StatRow label="Currently active" value={metrics.certifications.active} />
          <StatRow label="Expiring ≤ 30d" value={metrics.certifications.expiringSoon} />
        </Section>

        <Section
          icon={<Info className="h-4 w-4 text-primary" />}
          title="Support needs"
          empty={metrics.supportNeeds.openTotal === 0}
        >
          <StatRow label="Open requests" value={metrics.supportNeeds.openTotal} />
          {metrics.supportNeeds.byCategory.slice(0, 4).map((c) => (
            <StatRow key={c.key} label={`· ${c.key}`} value={c.count} />
          ))}
          {metrics.supportNeeds.byPriority
            .filter((p) => p.key === 'emergency' || p.key === 'high')
            .map((p) => (
              <StatRow key={p.key} label={`priority: ${p.key}`} value={p.count} />
            ))}
        </Section>

        <Section
          icon={<Handshake className="h-4 w-4 text-primary" />}
          title="Referrals"
          empty={metrics.referrals.createdInRange === 0}
        >
          <StatRow label="Created" value={metrics.referrals.createdInRange} />
          <StatRow label="Clicked through" value={metrics.referrals.clickedInRange} />
        </Section>

        <Section
          icon={<Target className="h-4 w-4 text-primary" />}
          title="Milestones (post-grad plans)"
          empty={
            metrics.milestones.plansOnFile === 0 &&
            metrics.milestones.graduationsInRange === 0
          }
        >
          <StatRow label="Plans on file" value={metrics.milestones.plansOnFile} />
          <StatRow label="Graduations in range" value={metrics.milestones.graduationsInRange} />
          <StatRow label="Stalled ≥ 30d" value={metrics.milestones.stalled} />
        </Section>

        <Section
          icon={<CalendarCheck className="h-4 w-4 text-primary" />}
          title="Engagement"
          derived
          empty={
            metrics.engagement.messagesSent === 0 &&
            metrics.engagement.messagesReceived === 0 &&
            metrics.engagement.activeDays === 0
          }
        >
          <StatRow label="Messages sent" value={metrics.engagement.messagesSent} />
          <StatRow label="Messages received" value={metrics.engagement.messagesReceived} />
          <StatRow label="Distinct active days" value={metrics.engagement.activeDays} />
        </Section>

        <Section
          icon={<Briefcase className="h-4 w-4 text-primary" />}
          title="Employment readiness"
          empty={
            metrics.employmentReadiness.employed === 0 &&
            metrics.employmentReadiness.seeking === 0 &&
            metrics.employmentReadiness.m05PostAvg == null
          }
        >
          <StatRow label="Employed" value={metrics.employmentReadiness.employed} />
          <StatRow label="Seeking" value={metrics.employmentReadiness.seeking} />
          <StatRow label="Unknown / not tracked" value={metrics.employmentReadiness.unknown} />
          <StatRow
            label="M05 workforce readiness (post)"
            value={
              metrics.employmentReadiness.m05PostAvg == null
                ? '—'
                : `${metrics.employmentReadiness.m05PostAvg.toFixed(2)} / 5`
            }
          />
        </Section>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Not tracked in this system: problem-solving and teamwork. These are shown as
        "—" rather than fabricated. Add them via a future intake or check-in question
        if you want them reported.
      </p>
    </div>
  );
}
