import { useMemo, useState } from 'react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Download, ArrowRightLeft, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useParticipantTransfers, useAllParticipantExports, useGetExportUrl } from '@/hooks/useParticipantTransfers';
import { ParticipantTransfersSection } from '@/components/transfers/ParticipantTransfersSection';
import { useToast } from '@/hooks/use-toast';

export default function TransitionsDashboard() {
  const { data: pending = [], isLoading: lp } = useParticipantTransfers({ status: ['pending'] });
  const { data: completed = [], isLoading: lc } = useParticipantTransfers({ status: ['acknowledged', 'completed'] });
  const { data: cancelled = [] } = useParticipantTransfers({ status: ['cancelled'] });
  const { data: exports = [], isLoading: le } = useAllParticipantExports();
  const getUrl = useGetExportUrl();
  const { toast } = useToast();

  const counts = useMemo(() => ({
    pending: pending.length,
    completed: completed.length,
    cancelled: cancelled.length,
    exports: exports.length,
  }), [pending, completed, cancelled, exports]);

  async function handleDownload(id: string) {
    try {
      const url = await getUrl.mutateAsync(id);
      window.open(url, '_blank');
    } catch (e: any) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    }
  }

  return (
    <SidebarLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <PageHeader
          title="Participant Transitions"
          description="Pending and completed transfers, missing records, export history, and access logs."
          icon={ArrowRightLeft}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Pending transfers" value={counts.pending} />
          <StatCard label="Acknowledged" value={counts.completed} />
          <StatCard label="Cancelled" value={counts.cancelled} />
          <StatCard label="Exports generated" value={counts.exports} />
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({counts.completed})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({counts.cancelled})</TabsTrigger>
            <TabsTrigger value="exports">Exports</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3">
            {lp ? <Skeleton className="h-32" /> : pending.length === 0 ? <EmptyMsg msg="No pending transfers." /> : <ParticipantTransfersSection />}
            {/* The section component shows all in scope; re-rendering for filtered list */}
            {!lp && pending.length > 0 && <FilteredTransferList transfers={pending} />}
          </TabsContent>
          <TabsContent value="completed" className="space-y-3">
            {lc ? <Skeleton className="h-32" /> : completed.length === 0 ? <EmptyMsg msg="No completed transfers yet." /> : <FilteredTransferList transfers={completed} />}
          </TabsContent>
          <TabsContent value="cancelled" className="space-y-3">
            {cancelled.length === 0 ? <EmptyMsg msg="No cancelled transfers." /> : <FilteredTransferList transfers={cancelled} />}
          </TabsContent>
          <TabsContent value="exports">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Export history</CardTitle>
                <CardDescription>All participant record exports generated platform-wide (within your scope).</CardDescription>
              </CardHeader>
              <CardContent>
                {le ? <Skeleton className="h-24" /> : exports.length === 0 ? <EmptyMsg msg="No exports yet." /> : (
                  <div className="space-y-2">
                    {exports.map((e) => (
                      <div key={e.id} className="flex items-center justify-between border rounded-md p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{e.format.toUpperCase()}</Badge>
                            <Badge variant="secondary">{e.purpose}</Badge>
                            {(e.validation_report?.length ?? 0) > 0 && (
                              <Badge variant="destructive">{e.validation_report.length} finding(s)</Badge>
                            )}
                            {e.transfer_id && <Badge>Transfer</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(e.created_at), 'PPpp')} •{' '}
                            <Link to={`/students/${e.student_id}?tab=transfers`} className="underline">View participant</Link>
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleDownload(e.id)} disabled={getUrl.isPending}>
                          <Download className="h-4 w-4 mr-1" /> Download
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return <Card><CardContent className="py-12 text-center text-muted-foreground">{msg}</CardContent></Card>;
}

function FilteredTransferList({ transfers }: { transfers: any[] }) {
  return (
    <div className="space-y-2">
      {transfers.map((t) => (
        <Card key={t.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              <Link to={`/students/${t.student_id}?tab=transfers`} className="hover:underline">
                Participant {t.student_id.slice(0, 8)}…
              </Link>
            </CardTitle>
            <CardDescription>
              {format(new Date(t.created_at), 'PPpp')} • status: <Badge variant="outline">{t.status}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {t.reason && <p className="text-sm">{t.reason}</p>}
            {t.acknowledged_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Acknowledged {format(new Date(t.acknowledged_at), 'PPpp')}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
