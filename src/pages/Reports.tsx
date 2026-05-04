import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, FileText, Loader2, Users, ClipboardList, ArrowRight } from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useCaseManagers } from '@/hooks/useCaseManagerStats';
import {
  useInteractionReport,
  getPresetRange,
  type ReportPreset,
} from '@/hooks/useInteractionReport';
import { ReportRangePicker } from '@/components/reports/ReportRangePicker';
import { ReportPreview } from '@/components/reports/ReportPreview';
import { exportReportCsv, exportReportPdf } from '@/lib/reportExport';
import { toast } from '@/hooks/use-toast';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';

export default function Reports() {
  const { user, role } = useAuth();
  const [searchParams] = useSearchParams();
  const initialPreset = (searchParams.get('preset') as ReportPreset) || 'weekly';

  const initialRange = useMemo(
    () =>
      initialPreset === 'custom'
        ? getPresetRange('weekly')
        : getPresetRange(initialPreset as Exclude<ReportPreset, 'custom'>),
    [initialPreset],
  );

  const [preset, setPreset] = useState<ReportPreset>(
    initialPreset === 'custom' ? 'weekly' : initialPreset,
  );
  const [from, setFrom] = useState<Date>(initialRange.from);
  const [to, setTo] = useState<Date>(initialRange.to);

  const isAdmin = role === 'admin';
  const urlCmId = searchParams.get('caseManagerId') || undefined;
  const { data: caseManagers } = useCaseManagers();
  const [selectedCmId, setSelectedCmId] = useState<string | undefined>(
    isAdmin ? urlCmId : user?.id,
  );

  // Default selection for admins once list loads
  useEffect(() => {
    if (isAdmin && !selectedCmId && caseManagers && caseManagers.length > 0) {
      setSelectedCmId(caseManagers[0].user_id);
    }
    if (!isAdmin && user?.id && selectedCmId !== user.id) {
      setSelectedCmId(user.id);
    }
  }, [isAdmin, caseManagers, selectedCmId, user?.id]);

  const { data, isLoading, isFetching, error, refetch } = useInteractionReport({
    caseManagerId: selectedCmId,
    from,
    to,
  });

  const handleExportPdf = () => {
    if (!data) return;
    try {
      exportReportPdf(data);
    } catch (e) {
      toast({ title: 'PDF export failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleExportCsv = () => {
    if (!data) return;
    try {
      exportReportCsv(data);
    } catch (e) {
      toast({ title: 'CSV export failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const exportsDisabled = !data || isLoading;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader
          title="Reports"
          description="Caseload summaries and per-student progress reports. Live data, downloadable as PDF or CSV."
        />

        <GlobalFilterBar visible={['cohort', 'yearOfStudy', 'organizationId', 'status', 'assignedCaseManagerId']} />

        <Tabs defaultValue="caseload" className="space-y-4">
          <TabsList>
            <TabsTrigger value="caseload" className="gap-2">
              <Users className="h-4 w-4" />
              Caseload
            </TabsTrigger>
            <TabsTrigger value="per-student" className="gap-2" asChild>
              <Link to="/reports/student">
                <ClipboardList className="h-4 w-4" />
                Per student
                <ArrowRight className="h-3 w-3 opacity-60" />
              </Link>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="caseload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Report options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Case manager:</span>
                    <Select value={selectedCmId} onValueChange={setSelectedCmId}>
                      <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder="Select a case manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {(caseManagers || []).map((cm) => (
                          <SelectItem key={cm.user_id} value={cm.user_id}>
                            {cm.full_name || cm.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <ReportRangePicker
                    preset={preset}
                    from={from}
                    to={to}
                    onChange={({ preset: p, from: f, to: t }) => {
                      setPreset(p);
                      setFrom(f);
                      setTo(t);
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => refetch()} disabled={!selectedCmId}>
                      {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                    </Button>
                    <Button variant="outline" onClick={handleExportCsv} disabled={exportsDisabled}>
                      <FileText className="mr-2 h-4 w-4" />
                      CSV
                    </Button>
                    <Button onClick={handleExportPdf} disabled={exportsDisabled}>
                      <Download className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <ReportPreview
              data={data}
              isLoading={isLoading && !!selectedCmId}
              isFetching={isFetching}
              error={error}
            />
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
