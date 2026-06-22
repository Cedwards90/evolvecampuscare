import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Props {
  step: number; // 1..5
  totalSteps?: number;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const STEP_LABELS = ['Profile', 'Sensitive Intake', 'Career Intake', 'CMF Basics', 'Personality Quiz'];

export function OnboardingShell({ step, totalSteps = 5, title, description, children, footer }: Props) {
  const pct = Math.round((step / totalSteps) * 100);
  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Welcome to Evolve</span>
            <span>
              Step {step} of {totalSteps} · {STEP_LABELS[step - 1]}
            </span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-6">{children}</CardContent>
        </Card>
        {footer}
      </div>
    </div>
  );
}
