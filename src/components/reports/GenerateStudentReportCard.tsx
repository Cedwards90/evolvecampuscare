import { useNavigate } from 'react-router-dom';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  /** When provided, deep-link to this student's report */
  studentId?: string;
  /** Title override (e.g. on a CM detail page: "Generate progress reports") */
  title?: string;
  description?: string;
}

export function GenerateStudentReportCard({
  studentId,
  title = 'Student progress report',
  description,
}: Props) {
  const navigate = useNavigate();
  const base = studentId
    ? `/reports/student/${studentId}`
    : '/reports/student';

  const go = (preset: 'daily' | 'weekly' | 'monthly') => {
    navigate(`${base}?preset=${preset}`);
  };

  return (
    <Card className="border border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {description ||
            'Detailed per-student summary of notes, requests, check-ins, risks, and recommended actions.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => go('weekly')}>
            Weekly
          </Button>
          <Button size="sm" variant="outline" onClick={() => go('daily')}>
            Daily
          </Button>
          <Button size="sm" variant="outline" onClick={() => go('monthly')}>
            Monthly
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => navigate(base)}
          >
            More options
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
