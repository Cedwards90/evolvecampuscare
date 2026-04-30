import { useNavigate } from 'react-router-dom';
import { FileBarChart, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface GenerateReportCardProps {
  caseManagerId?: string;
}

export function GenerateReportCard({ caseManagerId }: GenerateReportCardProps = {}) {
  const navigate = useNavigate();

  const cmParam = caseManagerId ? `&caseManagerId=${caseManagerId}` : '';
  const moreOptionsHref = caseManagerId ? `/reports?caseManagerId=${caseManagerId}` : '/reports';

  const go = (preset: 'daily' | 'weekly' | 'monthly') => {
    navigate(`/reports?preset=${preset}${cmParam}`);
  };

  return (
    <Card className="border border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FileBarChart className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Generate interaction report</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          One-click summary of your caseload activity.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => go('daily')}>Daily</Button>
          <Button size="sm" variant="outline" onClick={() => go('weekly')}>Weekly</Button>
          <Button size="sm" variant="outline" onClick={() => go('monthly')}>Monthly</Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => navigate('/reports')}
          >
            More options
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
