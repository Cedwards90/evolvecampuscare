import { useState } from 'react';
import { Plus, Pencil, Trash2, Award } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { useCertificationCatalog, CertificationCatalogEntry } from '@/hooks/useCertificationCatalog';
import { useToast } from '@/hooks/use-toast';

export function CertificationCatalogManager() {
  const { entries, isLoading, create, update, remove } = useCertificationCatalog();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CertificationCatalogEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CertificationCatalogEntry | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [issuer, setIssuer] = useState('');
  const [validity, setValidity] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setName(''); setCategory(''); setIssuer(''); setValidity(''); setActive(true);
    setError(null);
    setOpen(true);
  }

  function openEdit(entry: CertificationCatalogEntry) {
    setEditing(entry);
    setName(entry.name);
    setCategory(entry.category ?? '');
    setIssuer(entry.issuing_organization ?? '');
    setValidity(entry.default_validity_months?.toString() ?? '');
    setActive(entry.is_active);
    setError(null);
    setOpen(true);
  }

  async function handleSave() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    const validityNum = validity ? parseInt(validity, 10) : null;
    if (validity && (Number.isNaN(validityNum) || validityNum! < 1 || validityNum! > 600)) {
      setError('Validity must be between 1 and 600 months');
      return;
    }
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          name: trimmed,
          category: category.trim() || null,
          issuing_organization: issuer.trim() || null,
          default_validity_months: validityNum,
          is_active: active,
        });
        toast({ title: 'Catalog entry updated' });
      } else {
        await create.mutateAsync({
          name: trimmed,
          category: category.trim() || null,
          issuing_organization: issuer.trim() || null,
          default_validity_months: validityNum,
          is_active: active,
        });
        toast({ title: 'Catalog entry added' });
      }
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await remove.mutateAsync(confirmDelete.id);
      toast({ title: 'Removed' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Certification catalog
          </CardTitle>
          <CardDescription>Predefined certifications staff can assign to students.</CardDescription>
        </div>
        <Button size="sm" className="rounded-full" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner />
        ) : entries.length === 0 ? (
          <EmptyState icon={Award} title="No catalog entries yet" description="Add common certifications students complete." />
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {entry.name}
                    {!entry.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[entry.category, entry.issuing_organization, entry.default_validity_months ? `${entry.default_validity_months} mo validity` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(entry)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit catalog entry' : 'New catalog entry'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label>Validity (months)</Label>
                <Input type="number" min={1} max={600} value={validity} onChange={(e) => setValidity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default issuing organization</Label>
              <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} maxLength={150} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="cat-active">Active</Label>
              <Switch id="cat-active" checked={active} onCheckedChange={setActive} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="rounded-full">{editing ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete catalog entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing student certifications using this entry will keep their record but lose the link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
