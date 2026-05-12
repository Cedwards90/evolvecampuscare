import { useState } from 'react';
import { Award, Plus, Pencil, Trash2, Download, ExternalLink, AlertTriangle } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
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
import { useStudentCertifications, StudentCertification, CertificationStatus } from '@/hooks/useStudentCertifications';
import { useCertificationCatalog } from '@/hooks/useCertificationCatalog';
import { CertificationDialog } from './CertificationDialog';
import { useToast } from '@/hooks/use-toast';

interface Props {
  studentId: string;
  canManage: boolean;
}

const STATUS_LABEL: Record<CertificationStatus, string> = {
  in_progress: 'In progress',
  completed: 'Completed',
  expired: 'Expired',
  revoked: 'Revoked',
};

function statusVariant(status: CertificationStatus, expiration?: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'expired' || status === 'revoked') return 'destructive';
  if (status === 'completed') {
    if (expiration) {
      const days = differenceInDays(parseISO(expiration), new Date());
      if (days < 0) return 'destructive';
      if (days <= 30) return 'outline';
    }
    return 'default';
  }
  return 'secondary';
}

export function CertificationsSection({ studentId, canManage }: Props) {
  const { certifications, isLoading, remove, getSignedUrl } = useStudentCertifications(studentId);
  const { entries } = useCertificationCatalog({ activeOnly: false });
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StudentCertification | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StudentCertification | null>(null);

  const catalogMap = new Map(entries.map((e) => [e.id, e]));

  function nameOf(cert: StudentCertification): string {
    if (cert.catalog_id) return catalogMap.get(cert.catalog_id)?.name ?? 'Certification';
    return cert.custom_name ?? 'Certification';
  }

  async function handleDownload(cert: StudentCertification) {
    if (!cert.file_path) return;
    try {
      const url = await getSignedUrl(cert.file_path, 120);
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      toast({ title: 'Could not open file', description: e?.message, variant: 'destructive' });
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await remove.mutateAsync(confirmDelete);
      toast({ title: 'Certification removed' });
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
            Certifications
          </CardTitle>
          <CardDescription>Track completed and in-progress certifications.</CardDescription>
        </div>
        {canManage && (
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner />
        ) : certifications.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No certifications yet"
            description={canManage ? 'Add the first certification for this student.' : 'Nothing here yet.'}
          />
        ) : (
          <div className="space-y-3">
            {certifications.map((cert) => {
              const expSoon =
                cert.status === 'completed' &&
                cert.expiration_date &&
                differenceInDays(parseISO(cert.expiration_date), new Date()) >= 0 &&
                differenceInDays(parseISO(cert.expiration_date), new Date()) <= 30;
              return (
                <div
                  key={cert.id}
                  className="rounded-xl border p-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{nameOf(cert)}</span>
                      <Badge variant={statusVariant(cert.status, cert.expiration_date)}>
                        {STATUS_LABEL[cert.status]}
                      </Badge>
                      {expSoon && (
                        <Badge variant="outline" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Expiring soon
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 space-x-3">
                      {cert.issuing_organization && <span>{cert.issuing_organization}</span>}
                      {cert.completion_date && (
                        <span>Completed {format(parseISO(cert.completion_date), 'MMM d, yyyy')}</span>
                      )}
                      {cert.expiration_date && (
                        <span>Expires {format(parseISO(cert.expiration_date), 'MMM d, yyyy')}</span>
                      )}
                      {cert.credential_id && <span>ID: {cert.credential_id}</span>}
                    </div>
                    {cert.notes && <p className="text-sm mt-2 whitespace-pre-wrap">{cert.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {cert.file_path && (
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(cert)}>
                        <Download className="h-4 w-4 mr-1" /> File
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(cert);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDelete(cert)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {canManage && (
        <CertificationDialog
          open={open}
          onOpenChange={setOpen}
          studentId={studentId}
          existing={editing}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove certification?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the record and any uploaded file.
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
