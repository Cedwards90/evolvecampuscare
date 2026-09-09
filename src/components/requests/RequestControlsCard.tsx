import { useState } from 'react';
import { format } from 'date-fns';
import { ShieldCheck, Banknote, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useControlsSettings, useFundingSources } from '@/hooks/useInternalControls';
import {
  useSecondApproval,
  useRecordPayment,
  useConfirmReceipt,
  useReceiptOverride,
  useSetRequestCoding,
} from '@/hooks/useRequestControls';
import { useStaffNames } from '@/hooks/useStaffNames';

const PAYMENT_METHODS = ['Zelle', 'Check', 'Card', 'Cash', 'Other'];

const money = (v: number | null | undefined) =>
  v === null || v === undefined
    ? '—'
    : Number(v).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

interface RequestControlsCardProps {
  request: any;
  /** Staff view shows approvals, payment and coding. */
  isStaff: boolean;
  isAdmin: boolean;
  /** The participant's own view shows only the confirmation step. */
  isOwner: boolean;
}

export function RequestControlsCard({ request, isStaff, isAdmin, isOwner }: RequestControlsCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: settings } = useControlsSettings();
  const { data: fundingSources } = useFundingSources(true);
  const secondApproval = useSecondApproval();
  const recordPayment = useRecordPayment();
  const confirmReceipt = useConfirmReceipt();
  const override = useReceiptOverride();
  const setCoding = useSetRequestCoding();

  const approverIds = [request.approval_decided_by, request.second_approval_by, request.paid_by].filter(Boolean);
  const { data: names } = useStaffNames(approverIds as string[]);

  const threshold = Number(settings?.second_approval_threshold ?? 500);
  const approvedAmount = request.approved_amount != null ? Number(request.approved_amount) : null;
  const hasMoney = approvedAmount != null || request.requested_amount != null || request.amount_paid != null;

  const [payment, setPayment] = useState({
    amount: approvedAmount != null ? String(approvedAmount) : '',
    date: new Date().toISOString().slice(0, 10),
    method: 'Zelle',
    reference: '',
  });
  const [confirmAmount, setConfirmAmount] = useState(
    request.amount_paid != null ? String(request.amount_paid) : '',
  );
  const [confirmDate, setConfirmDate] = useState(new Date().toISOString().slice(0, 10));
  const [overrideReason, setOverrideReason] = useState('');

  if (!hasMoney) return null;

  const needsSecond = approvedAmount != null && approvedAmount > threshold;
  const secondDone = !!request.second_approval_at;
  const paid = !!request.paid_at;
  const confirmed = !!request.participant_confirmed_at;
  const overridden = !!request.receipt_override_reason;

  const nameOf = (id: string | null) => (id ? names?.[id] ?? 'Staff member' : '—');
  const sameAsFirstApprover = user?.id && request.approval_decided_by === user.id;

  // Participant-only view: confirm what was received
  if (isOwner && !isStaff) {
    if (!paid) return null;
    return (
      <Card className={confirmed ? undefined : 'border-primary/50'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Confirm the funds you received
          </CardTitle>
          <CardDescription>
            {money(request.amount_paid)} was sent to you on {format(new Date(request.paid_at), 'PP')}
            {request.payment_method ? ` by ${request.payment_method}` : ''}. Please confirm what you actually received.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirmed ? (
            <p className="text-sm">
              You confirmed {money(request.participant_confirmed_amount)} received on{' '}
              {format(new Date(request.participant_confirmed_at), 'PP')}. Thank you.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="confirm-amount">Amount received</Label>
                  <Input
                    id="confirm-amount"
                    type="number"
                    step="0.01"
                    value={confirmAmount}
                    onChange={(e) => setConfirmAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirm-date">Date received</Label>
                  <Input
                    id="confirm-date"
                    type="date"
                    value={confirmDate}
                    onChange={(e) => setConfirmDate(e.target.value)}
                  />
                </div>
              </div>
              <Button
                disabled={!confirmAmount || !confirmDate || confirmReceipt.isPending}
                onClick={async () => {
                  if (!user) return;
                  try {
                    await confirmReceipt.mutateAsync({
                      requestId: request.id,
                      userId: user.id,
                      amount: Number(confirmAmount),
                      receivedOn: confirmDate,
                    });
                    toast({ title: 'Thank you', description: 'Your confirmation has been recorded.' });
                  } catch (e: any) {
                    toast({ title: 'Could not save', description: e?.message, variant: 'destructive' });
                  }
                }}
              >
                {confirmReceipt.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm receipt
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!isStaff) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Approval & payment record
        </CardTitle>
        <CardDescription>
          Each step is stamped with a name and time. Approvers cannot approve twice, and whoever records the payment
          cannot be an approver.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chain */}
        <div className="space-y-2 text-sm">
          <ChainRow
            label="Approved by"
            done={!!request.approval_decided_at}
            who={nameOf(request.approval_decided_by)}
            when={request.approval_decided_at}
            detail={approvedAmount != null ? money(approvedAmount) : undefined}
          />
          {needsSecond && (
            <ChainRow
              label={`Second approval (over ${money(threshold)})`}
              done={secondDone}
              who={nameOf(request.second_approval_by)}
              when={request.second_approval_at}
            />
          )}
          <ChainRow
            label="Paid by"
            done={paid}
            who={nameOf(request.paid_by)}
            when={request.paid_at}
            detail={
              paid
                ? `${money(request.amount_paid)}${request.payment_method ? ` · ${request.payment_method}` : ''}${
                    request.payment_reference ? ` · ref ${request.payment_reference}` : ''
                  }`
                : undefined
            }
          />
          <ChainRow
            label="Participant confirmed"
            done={confirmed || overridden}
            who={confirmed ? 'Participant' : overridden ? `Override by ${nameOf(request.receipt_override_by)}` : '—'}
            when={request.participant_confirmed_at}
            detail={confirmed ? money(request.participant_confirmed_amount) : request.receipt_override_reason || undefined}
          />
        </div>

        {paid && approvedAmount != null && Number(request.amount_paid) !== approvedAmount && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
            <span>
              Approved {money(approvedAmount)} but paid {money(request.amount_paid)}. Follow up so the Hub matches the
              bank.
            </span>
          </div>
        )}

        {/* Second approval */}
        {needsSecond && !secondDone && isAdmin && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Second approval required</p>
              <p className="text-xs text-muted-foreground">
                {sameAsFirstApprover
                  ? 'You recorded the first approval, so another administrator must give the second.'
                  : `This request is over ${money(threshold)}. Confirm you have reviewed it.`}
              </p>
              <Button
                size="sm"
                disabled={!!sameAsFirstApprover || secondApproval.isPending}
                onClick={async () => {
                  if (!user) return;
                  try {
                    await secondApproval.mutateAsync({ requestId: request.id, userId: user.id });
                    toast({ title: 'Second approval recorded' });
                  } catch (e: any) {
                    toast({ title: 'Could not record approval', description: e?.message, variant: 'destructive' });
                  }
                }}
              >
                {secondApproval.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record second approval
              </Button>
            </div>
          </>
        )}

        {/* Payment entry */}
        {!paid && isAdmin && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Banknote className="h-4 w-4" /> Record the payment
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="pay-amount">Amount paid</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    step="0.01"
                    value={payment.amount}
                    onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pay-date">Date paid</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={payment.date}
                    onChange={(e) => setPayment((p) => ({ ...p, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Method</Label>
                  <Select value={payment.method} onValueChange={(v) => setPayment((p) => ({ ...p, method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pay-ref">Reference / confirmation number</Label>
                  <Input
                    id="pay-ref"
                    value={payment.reference}
                    onChange={(e) => setPayment((p) => ({ ...p, reference: e.target.value }))}
                    placeholder="Use the same class & funding wording as the transfer"
                  />
                </div>
              </div>
              <Button
                size="sm"
                disabled={!payment.amount || !payment.date || recordPayment.isPending}
                onClick={async () => {
                  if (!user) return;
                  try {
                    await recordPayment.mutateAsync({
                      requestId: request.id,
                      userId: user.id,
                      amountPaid: Number(payment.amount),
                      paidAt: payment.date,
                      method: payment.method,
                      reference: payment.reference,
                    });
                    toast({ title: 'Payment recorded', description: 'The participant has been asked to confirm receipt.' });
                  } catch (e: any) {
                    toast({ title: 'Could not record payment', description: e?.message, variant: 'destructive' });
                  }
                }}
              >
                {recordPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record payment
              </Button>
            </div>
          </>
        )}

        {/* Override */}
        {paid && !confirmed && !overridden && isAdmin && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="override-reason">
                Participant cannot confirm? Record why (required before resolving)
              </Label>
              <Textarea
                id="override-reason"
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. confirmed verbally in person on 3 May; receipt uploaded"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!overrideReason.trim() || override.isPending}
                onClick={async () => {
                  if (!user) return;
                  try {
                    await override.mutateAsync({ requestId: request.id, userId: user.id, reason: overrideReason });
                    toast({ title: 'Override recorded' });
                    setOverrideReason('');
                  } catch (e: any) {
                    toast({ title: 'Could not record override', description: e?.message, variant: 'destructive' });
                  }
                }}
              >
                {override.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record override
              </Button>
            </div>
          </>
        )}

        {/* Coding */}
        {isStaff && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label>Funding source</Label>
              <Select
                value={request.funding_source_id ?? 'none'}
                onValueChange={async (v) => {
                  if (!user) return;
                  try {
                    await setCoding.mutateAsync({
                      requestId: request.id,
                      userId: user.id,
                      fundingSourceId: v === 'none' ? null : v,
                    });
                    toast({ title: 'Funding source updated' });
                  } catch (e: any) {
                    toast({ title: 'Could not update', description: e?.message, variant: 'destructive' });
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {(fundingSources || []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(fundingSources || []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No funding sources set up yet — an administrator can add them under Internal controls.
                </p>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (!user) return;
                    await setCoding.mutateAsync({
                      requestId: request.id,
                      userId: user.id,
                      isTestRecord: !request.is_test_record,
                    });
                  }}
                >
                  {request.is_test_record ? 'Unmark as test record' : 'Mark as test record'}
                </Button>
              )}
              {request.is_test_record && <Badge variant="secondary">Test record — excluded from reporting</Badge>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ChainRow({
  label,
  done,
  who,
  when,
  detail,
}: {
  label: string;
  done: boolean;
  who: string;
  when?: string | null;
  detail?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border p-2 min-w-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right min-w-0 break-words">
        {done ? (
          <>
            <strong>{who}</strong>
            {when ? ` · ${format(new Date(when), 'PPp')}` : ''}
            {detail ? ` · ${detail}` : ''}
          </>
        ) : (
          <Badge variant="outline">Pending</Badge>
        )}
      </span>
    </div>
  );
}
