import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useParticipantTransfers, useTransferEvents, useAcknowledgeTransfer, useCancelTransfer } from '@/hooks/useParticipantTransfers';
import { useTrainingOrganizations } from '@/hooks/useTrainingOrganizations';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, XCircle, Clock, ArrowRightLeft } from 'lucide-react';

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-900', Icon: Clock },
    acknowledged: { label: 'Acknowledged', cls: 'bg-emerald-100 text-emerald-900', Icon: CheckCircle2 },
    completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-900', Icon: CheckCircle2 },
    cancelled: { label: 'Cancelled', cls: 'bg-muted text-muted-foreground', Icon: XCircle },
  };
  const m = map[status] ?? map.pending;
  return <Badge className={m.cls + ' gap-1'}><m.Icon className="h-3 w-3" />{m.label}</Badge>;
}

interface Props {
  studentId?: string;
}

export function ParticipantTransfersSection({ studentId }: Props) {
  const { data: transfers = [], isLoading } = useParticipantTransfers(studentId ? { student_id: studentId } : undefined);
  const { data: orgs = [] } = useTrainingOrganizations();
  const ack = useAcknowledgeTransfer();
  const cancel = useCancelTransfer();
  const { toast } = useToast();
  const { user } = useAuth();

  const orgName = useMemo(() => {
    const m = new Map<string, string>();
    orgs.forEach((o) => m.set(o.id, o.name));
    return (id: string | null) => (id ? m.get(id) || 'Unknown' : '—');
  }, [orgs]);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!transfers.length) return <p className="text-sm text-muted-foreground">No transfers on record.</p>;

  return (
    <div className="space-y-3">
      {transfers.map((t) => (
        <TransferRow
          key={t.id}
          transfer={t}
          orgName={orgName}
          onAcknowledge={async () => {
            const notes = window.prompt('Optional acknowledgement notes:') || '';
            try { await ack.mutateAsync({ transfer_id: t.id, notes }); toast({ title: 'Transfer acknowledged' }); }
            catch (e: any) { toast({ title: 'Failed', description: e.message, variant: 'destructive' }); }
          }}
          onCancel={async () => {
            const reason = window.prompt('Cancellation reason:') || '';
            if (!reason) return;
            try { await cancel.mutateAsync({ transfer_id: t.id, reason }); toast({ title: 'Transfer cancelled' }); }
            catch (e: any) { toast({ title: 'Failed', description: e.message, variant: 'destructive' }); }
          }}
          currentUserId={user?.id}
        />
      ))}
    </div>
  );
}

function TransferRow({ transfer: t, orgName, onAcknowledge, onCancel, currentUserId }: any) {
  const { data: events = [] } = useTransferEvents(t.id);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            {orgName(t.from_organization_id)} → {orgName(t.to_organization_id)}
          </CardTitle>
          {statusBadge(t.status)}
        </div>
        <CardDescription>
          {format(new Date(t.created_at), 'PPpp')} • {(t.included_record_types || []).length} record type(s)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {t.reason && <p className="text-sm">{t.reason}</p>}
        {(t.included_record_types || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {t.included_record_types.map((r: string) => (
              <Badge key={r} variant="outline" className="text-xs">{r.replace(/_/g, ' ')}</Badge>
            ))}
          </div>
        )}
        {events.length > 0 && (
          <div className="border-l-2 pl-3 space-y-1">
            {events.map((e: any) => (
              <p key={e.id} className="text-xs text-muted-foreground">
                {format(new Date(e.created_at), 'PPpp')} — <span className="font-medium">{e.event_type}</span>
                {e.metadata?.reason ? `: ${e.metadata.reason}` : ''}
              </p>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link to={`/students/${t.student_id}?tab=transfers`}>Open participant</Link>
          </Button>
          {t.status === 'pending' && (
            <>
              <Button size="sm" onClick={onAcknowledge}>Acknowledge receipt</Button>
              {t.initiated_by === currentUserId && (
                <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
