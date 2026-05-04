import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, QrCode, Power, BarChart3, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { QRPosterPreview } from '@/components/qr/QRPosterPreview';
import { makeShortCode } from '@/lib/qr';

type DestinationType = 'request' | 'meeting' | 'external';

interface QRCodeRow {
  id: string;
  code: string;
  label: string;
  organization_id: string | null;
  is_active: boolean;
  created_at: string;
  destination_type: DestinationType;
  destination_url: string | null;
  title: string | null;
  description: string | null;
  prefill_category: string | null;
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

const CATEGORIES = ['academic', 'financial', 'mental_health', 'housing', 'other'] as const;

function EditQRDialog({ row, open, onOpenChange }: { row: QRCodeRow; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState(row.title || row.label);
  const [description, setDescription] = useState(row.description || '');
  const [destinationType, setDestinationType] = useState<DestinationType>(row.destination_type || 'request');
  const [destinationUrl, setDestinationUrl] = useState(row.destination_url || '');
  const [prefillCategory, setPrefillCategory] = useState<string>(row.prefill_category || 'none');
  const [isActive, setIsActive] = useState(row.is_active);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(row.title || row.label);
    setDescription(row.description || '');
    setDestinationType(row.destination_type || 'request');
    setDestinationUrl(row.destination_url || '');
    setPrefillCategory(row.prefill_category || 'none');
    setIsActive(row.is_active);
  }, [row, open]);

  const handleSave = async () => {
    if (title.length > 80) return toast({ variant: 'destructive', title: 'Title too long', description: 'Max 80 characters.' });
    if (description.length > 280) return toast({ variant: 'destructive', title: 'Description too long', description: 'Max 280 characters.' });
    if (destinationType === 'external') {
      if (!/^https:\/\//i.test(destinationUrl.trim())) {
        return toast({ variant: 'destructive', title: 'Invalid URL', description: 'External URL must start with https://' });
      }
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('qr_codes')
        .update({
          title: title.trim() || null,
          description: description.trim() || null,
          destination_type: destinationType,
          destination_url: destinationType === 'external' ? destinationUrl.trim() : null,
          prefill_category: prefillCategory === 'none' ? null : (prefillCategory as any),
          is_active: isActive,
        })
        .eq('id', row.id);
      if (error) throw error;
      toast({ title: 'QR code updated' });
      queryClient.invalidateQueries({ queryKey: ['qr-codes'] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit QR Code</DialogTitle>
          <DialogDescription>Customize what students see when they scan this code.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <Label>Title <span className="text-xs text-muted-foreground">(shown on landing)</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Destination</Label>
            <RadioGroup value={destinationType} onValueChange={(v) => setDestinationType(v as DestinationType)}>
              <div className="flex items-center gap-2"><RadioGroupItem value="request" id="d-req" /><Label htmlFor="d-req" className="font-normal">Universal support request form</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="meeting" id="d-meet" /><Label htmlFor="d-meet" className="font-normal">Schedule a meeting</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="external" id="d-ext" /><Label htmlFor="d-ext" className="font-normal">External URL</Label></div>
            </RadioGroup>
          </div>
          {destinationType === 'external' && (
            <div>
              <Label>External URL</Label>
              <Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://…" />
            </div>
          )}
          {destinationType === 'request' && (
            <div>
              <Label>Prefill category (optional)</Label>
              <Select value={prefillCategory} onValueChange={setPrefillCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">Inactive codes show an unavailable message.</div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [editOpen, setEditOpen] = useState(false);

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
        .select('id,code,label,organization_id,is_active,created_at,destination_type,destination_url,title,description,prefill_category')
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

  const handleDelete = async (row: QRCodeRow) => {
    const { error } = await supabase.from('qr_codes').delete().eq('id', row.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Could not delete', description: error.message });
      return;
    }
    if (selectedId === row.id) setSelectedId(null);
    queryClient.invalidateQueries({ queryKey: ['qr-codes'] });
    toast({ title: 'QR code deleted', description: 'Printed copies will no longer work.' });
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
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="font-display truncate">{selected.title || selected.label}</CardTitle>
                      <CardDescription className="truncate">
                        {selected.organization_id ? orgName[selected.organization_id] : 'Global access'} · destination: {selected.destination_type || 'request'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditOpen(true)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Switch checked={selected.is_active} onCheckedChange={() => toggleActive(selected)} />
                      <span className="text-xs text-muted-foreground hidden sm:inline"><Power className="h-3 w-3 inline" /> {selected.is_active ? 'Active' : 'Inactive'}</span>
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

        {selected && (
          <EditQRDialog row={selected} open={editOpen} onOpenChange={setEditOpen} />
        )}
      </div>
    </SidebarLayout>
  );
}
