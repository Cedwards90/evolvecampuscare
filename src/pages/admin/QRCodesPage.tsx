import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, QrCode, Power, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { QRPosterPreview } from '@/components/qr/QRPosterPreview';
import { makeShortCode } from '@/lib/qr';

interface QRCodeRow {
  id: string;
  code: string;
  label: string;
  organization_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface FunnelStats {
  scans: number;
  sessions: number;
  authCompleted: number;
  actionStarted: number;
  actionCompleted: number;
  requestCompleted: number;
  meetingCompleted: number;
}

function useQRStats(qrCodeId: string) {
  return useQuery({
    queryKey: ['qr-stats', qrCodeId],
    queryFn: async (): Promise<FunnelStats> => {
      const { data } = await supabase
        .from('qr_scan_events')
        .select('event_type,session_id,action_kind')
        .eq('qr_code_id', qrCodeId);
      const rows = data || [];
      const sessions = new Set(rows.map((r: any) => r.session_id));
      return {
        scans: rows.filter((r: any) => r.event_type === 'scan').length,
        sessions: sessions.size,
        authCompleted: rows.filter((r: any) => r.event_type === 'auth_completed').length,
        actionStarted: rows.filter((r: any) => r.event_type === 'action_started').length,
        actionCompleted: rows.filter((r: any) => r.event_type === 'action_completed').length,
        requestCompleted: rows.filter((r: any) => r.event_type === 'action_completed' && r.action_kind === 'request').length,
        meetingCompleted: rows.filter((r: any) => r.event_type === 'action_completed' && r.action_kind === 'meeting').length,
      };
    },
  });
}

function StatsBlock({ qrCodeId }: { qrCodeId: string }) {
  const { data, isLoading } = useQRStats(qrCodeId);
  if (isLoading || !data) return <Loader2 className="h-4 w-4 animate-spin" />;
  const items = [
    { label: 'Scans', value: data.scans },
    { label: 'Unique', value: data.sessions },
    { label: 'Logged in', value: data.authCompleted },
    { label: 'Started', value: data.actionStarted },
    { label: 'Completed', value: data.actionCompleted },
    { label: 'Requests', value: data.requestCompleted },
    { label: 'Meetings', value: data.meetingCompleted },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border bg-muted/30 p-3 text-center">
          <div className="text-2xl font-bold text-primary">{i.value}</div>
          <div className="text-xs text-muted-foreground">{i.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function QRCodesPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [orgId, setOrgId] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: orgs } = useQuery({
    queryKey: ['training-orgs-active'],
    queryFn: async () => {
      const { data } = await supabase.from('training_organizations').select('id,name').eq('is_active', true).order('name');
      return data || [];
    },
  });

  const { data: codes, isLoading } = useQuery({
    queryKey: ['qr-codes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('qr_codes')
        .select('id,code,label,organization_id,is_active,created_at')
        .order('created_at', { ascending: false });
      return (data || []) as QRCodeRow[];
    },
  });

  const orgName = useMemo(() => {
    const map: Record<string, string> = {};
    (orgs || []).forEach((o: any) => (map[o.id] = o.name));
    return map;
  }, [orgs]);

  useEffect(() => {
    if (codes && codes.length && !selectedId) setSelectedId(codes[0].id);
  }, [codes, selectedId]);

  const handleCreate = async () => {
    if (!label.trim() || !user) return;
    setCreating(true);
    try {
      let code = makeShortCode(8);
      const { error } = await supabase.from('qr_codes').insert({
        code,
        label: label.trim(),
        organization_id: orgId || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: 'QR code created' });
      setOpen(false);
      setLabel('');
      setOrgId('');
      queryClient.invalidateQueries({ queryKey: ['qr-codes'] });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to create', description: e.message });
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (row: QRCodeRow) => {
    await supabase.from('qr_codes').update({ is_active: !row.is_active }).eq('id', row.id);
    queryClient.invalidateQueries({ queryKey: ['qr-codes'] });
  };

  const selected = codes?.find((c) => c.id === selectedId);

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <PageHeader
          title="QR Code Access"
          description="Generate printable QR codes that let students submit requests or schedule meetings from their phone."
        >
          <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full"><Plus className="mr-2 h-4 w-4" /> New QR Code</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create QR Code</DialogTitle>
                  <DialogDescription>Generate a poster students can scan to submit a request or schedule a meeting.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Label</Label>
                    <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Main Hall Lobby" />
                  </div>
                  <div>
                    <Label>Organization (optional)</Label>
                    <Select value={orgId} onValueChange={setOrgId}>
                      <SelectTrigger><SelectValue placeholder="None — global" /></SelectTrigger>
                      <SelectContent>
                        {(orgs || []).map((o: any) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating || !label.trim()}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </PageHeader>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !codes?.length ? (
          <Card>
            <CardContent className="p-12 text-center space-y-3">
              <QrCode className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No QR codes yet. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-1">
              {codes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left rounded-lg border p-4 transition-colors hover:border-primary/50 ${selectedId === c.id ? 'border-primary bg-primary/5' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.label}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.organization_id ? orgName[c.organization_id] || 'Org' : 'Global'} · /qr/{c.code}
                      </div>
                    </div>
                    <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </button>
              ))}
            </div>

            {selected && (
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="font-display">{selected.label}</CardTitle>
                      <CardDescription>{selected.organization_id ? orgName[selected.organization_id] : 'Global access'}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={selected.is_active} onCheckedChange={() => toggleActive(selected)} />
                      <span className="text-xs text-muted-foreground"><Power className="h-3 w-3 inline" /> {selected.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <QRPosterPreview code={selected.code} label={selected.label} organizationName={selected.organization_id ? orgName[selected.organization_id] : null} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Funnel Analytics</CardTitle>
                    <CardDescription>Tracks scans through to completed actions for this code.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StatsBlock qrCodeId={selected.id} />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
