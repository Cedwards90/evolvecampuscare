import { useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCommunityResources, type CommunityResource } from '@/hooks/useCommunityResources';
import { RESOURCE_CATEGORIES } from '@/lib/resourceMatching';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

interface FormState {
  id?: string;
  category: string;
  name: string;
  address: string;
  website: string;
  contact: string;
  phone: string;
  description: string;
  is_active: boolean;
}

const EMPTY: FormState = {
  category: RESOURCE_CATEGORIES[0],
  name: '',
  address: '',
  website: '',
  contact: '',
  phone: '',
  description: '',
  is_active: true,
};

export default function ResourcesAdmin() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const canEditRow = (r: CommunityResource) => isAdmin || (!!user && r.created_by === user.id);

  const { data, isLoading } = useCommunityResources({
    category: category === 'all' ? undefined : category,
    search,
    includeInactive: true,
  });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        category: f.category,
        name: f.name.trim(),
        address: f.address.trim() || null,
        website: f.website.trim() || null,
        contact: f.contact.trim() || null,
        phone: f.phone.trim() || null,
        description: f.description.trim() || null,
        is_active: f.is_active,
      };
      if (f.id) {
        const { error } = await supabase.from('community_resources').update(payload).eq('id', f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('community_resources').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Saved' });
      qc.invalidateQueries({ queryKey: ['community_resources'] });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('community_resources').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Deleted' });
      qc.invalidateQueries({ queryKey: ['community_resources'] });
    },
    onError: (e: any) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(r: CommunityResource) {
    setForm({
      id: r.id,
      category: r.category,
      name: r.name,
      address: r.address || '',
      website: r.website || '',
      contact: r.contact || '',
      phone: r.phone || '',
      description: r.description || '',
      is_active: r.is_active,
    });
    setOpen(true);
  }

  return (
    <SidebarLayout>
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader title="Community Resources" description="Manage the curated resource database.">
          <Button onClick={openNew} className="rounded-full">
            <Plus className="h-4 w-4 mr-1" /> Add resource
          </Button>
        </PageHeader>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-full"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-72 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {RESOURCE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden md:table-cell">Address</TableHead>
                  <TableHead className="hidden lg:table-cell">Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data || []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs">{r.category}</TableCell>
                    <TableCell className="text-xs hidden md:table-cell">{r.address}</TableCell>
                    <TableCell className="text-xs hidden lg:table-cell">{r.phone}</TableCell>
                    <TableCell className="text-xs">{r.is_active ? 'Active' : 'Hidden'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete "${r.name}"?`)) del.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit resource' : 'New resource'}</DialogTitle>
            <DialogDescription>Community organization details surfaced to students.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Contact (email or URL)</Label>
              <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="text-sm">Visible to students</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate(form)} disabled={!form.name.trim() || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  );
}
