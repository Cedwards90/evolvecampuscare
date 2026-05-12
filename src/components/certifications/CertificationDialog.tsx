import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCertificationCatalog } from '@/hooks/useCertificationCatalog';
import {
  ALLOWED_CERT_MIME,
  CertificationInput,
  CertificationStatus,
  MAX_CERT_FILE_BYTES,
  StudentCertification,
  useStudentCertifications,
} from '@/hooks/useStudentCertifications';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  existing?: StudentCertification | null;
}

const CUSTOM_VALUE = '__custom__';

const schema = z
  .object({
    catalog_id: z.string().nullable(),
    custom_name: z.string().max(150).optional(),
    issuing_organization: z.string().max(150).optional(),
    status: z.enum(['in_progress', 'completed', 'expired', 'revoked']),
    completion_date: z.string().optional(),
    expiration_date: z.string().optional(),
    credential_id: z.string().max(100).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => v.catalog_id || (v.custom_name && v.custom_name.trim().length > 0), {
    message: 'Pick a certification or enter a custom name',
    path: ['custom_name'],
  })
  .refine(
    (v) => !v.completion_date || !v.expiration_date || v.expiration_date >= v.completion_date,
    { message: 'Expiration must be on or after completion date', path: ['expiration_date'] },
  );

export function CertificationDialog({ open, onOpenChange, studentId, existing }: Props) {
  const { toast } = useToast();
  const { entries, isLoading: catalogLoading } = useCertificationCatalog({ activeOnly: true });
  const { create, update } = useStudentCertifications(studentId);

  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [status, setStatus] = useState<CertificationStatus>('in_progress');
  const [completion, setCompletion] = useState('');
  const [expiration, setExpiration] = useState('');
  const [credential, setCredential] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRemoveFile(false);
    setFile(null);
    if (existing) {
      setCatalogId(existing.catalog_id);
      setCustomName(existing.custom_name ?? '');
      setIssuer(existing.issuing_organization ?? '');
      setStatus(existing.status);
      setCompletion(existing.completion_date ?? '');
      setExpiration(existing.expiration_date ?? '');
      setCredential(existing.credential_id ?? '');
      setNotes(existing.notes ?? '');
    } else {
      setCatalogId(null);
      setCustomName('');
      setIssuer('');
      setStatus('in_progress');
      setCompletion('');
      setExpiration('');
      setCredential('');
      setNotes('');
    }
  }, [open, existing]);

  const selectedEntry = useMemo(() => entries.find((e) => e.id === catalogId), [entries, catalogId]);

  // Auto-populate issuer/expiration from catalog defaults when picking
  function handlePickCatalog(value: string) {
    if (value === CUSTOM_VALUE) {
      setCatalogId(null);
      return;
    }
    const entry = entries.find((e) => e.id === value);
    setCatalogId(value);
    setCustomName('');
    if (entry?.issuing_organization && !issuer) setIssuer(entry.issuing_organization);
    if (entry?.default_validity_months && completion && !expiration) {
      const d = new Date(completion);
      d.setMonth(d.getMonth() + entry.default_validity_months);
      setExpiration(d.toISOString().slice(0, 10));
    }
  }

  // Recompute expiration if completion date changes and a catalog default exists
  useEffect(() => {
    if (selectedEntry?.default_validity_months && completion && !expiration) {
      const d = new Date(completion);
      d.setMonth(d.getMonth() + selectedEntry.default_validity_months);
      setExpiration(d.toISOString().slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completion]);

  async function handleSubmit() {
    setError(null);
    const parsed = schema.safeParse({
      catalog_id: catalogId,
      custom_name: customName,
      issuing_organization: issuer,
      status,
      completion_date: completion || undefined,
      expiration_date: expiration || undefined,
      credential_id: credential,
      notes,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    if (file) {
      if (file.size > MAX_CERT_FILE_BYTES) {
        setError('File must be 10 MB or smaller');
        return;
      }
      if (!ALLOWED_CERT_MIME.includes(file.type)) {
        setError('Only PDF, PNG, JPG, or WebP files are allowed');
        return;
      }
    }

    const input: CertificationInput = {
      catalog_id: catalogId,
      custom_name: catalogId ? null : customName,
      issuing_organization: issuer,
      status,
      completion_date: completion || null,
      expiration_date: expiration || null,
      credential_id: credential,
      notes,
      file,
      removeFile,
    };

    setSubmitting(true);
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, input, existing });
        toast({ title: 'Certification updated' });
      } else {
        await create.mutateAsync(input);
        toast({ title: 'Certification added' });
      }
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit certification' : 'Add certification'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Certification</Label>
            <Select
              value={catalogId ?? CUSTOM_VALUE}
              onValueChange={handlePickCatalog}
              disabled={catalogLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a certification" />
              </SelectTrigger>
              <SelectContent>
                {entries.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                    {e.category ? ` · ${e.category}` : ''}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_VALUE}>Custom certification…</SelectItem>
              </SelectContent>
            </Select>
            {!catalogId && (
              <Input
                placeholder="Custom certification name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                maxLength={150}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CertificationStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Issuing organization</Label>
              <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} maxLength={150} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Completion date</Label>
              <Input type="date" value={completion} onChange={(e) => setCompletion(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Expiration date</Label>
              <Input type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Credential ID</Label>
            <Input value={credential} onChange={(e) => setCredential(e.target.value)} maxLength={100} />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </div>

          <div className="space-y-2">
            <Label>Certificate file (PDF or image, max 10 MB)</Label>
            {existing?.file_name && !removeFile && !file && (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="truncate">{existing.file_name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRemoveFile(true)}>
                  <X className="h-4 w-4 mr-1" /> Remove
                </Button>
              </div>
            )}
            <Input
              type="file"
              accept={ALLOWED_CERT_MIME.join(',')}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setRemoveFile(false);
              }}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            {existing ? 'Save changes' : 'Add certification'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
