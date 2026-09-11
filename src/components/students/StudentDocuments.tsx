import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File as FileIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  useStudentDocuments,
  useUploadStudentDocument,
  useDeleteStudentDocument,
  getStudentDocumentUrl,
  categoryLabel,
  DOCUMENT_CATEGORIES,
  ALLOWED_DOC_MIME,
  MAX_DOCS_PER_STUDENT,
  type DocumentCategory,
  type StudentDocument,
} from '@/hooks/useStudentDocuments';

interface Props {
  studentId: string;
}

const ACCEPTED_LABEL = 'PDF, Word, Excel, CSV, JPG, PNG, WEBP, HEIC, GIF, TXT';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getIcon(mime: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  if (mime.includes('sheet') || mime === 'text/csv') return FileSpreadsheet;
  return FileIcon;
}

export function StudentDocuments({ studentId }: Props) {
  const { user, role } = useAuth();
  const { data: documents = [], isLoading } = useStudentDocuments(studentId);
  const upload = useUploadStudentDocument(studentId);
  const remove = useDeleteStudentDocument(studentId);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>('id_documents');
  const [description, setDescription] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState<{ id: string; name: string; progress: number }[]>([]);

  const canDelete = (doc: StudentDocument) =>
    user?.id === doc.uploaded_by || role === 'admin' || role === 'org_admin';

  const visible = useMemo(
    () => (filter === 'all' ? documents : documents.filter((d) => d.category === filter)),
    [documents, filter],
  );

  const usedCategories = useMemo(
    () => DOCUMENT_CATEGORIES.filter((c) => documents.some((d) => d.category === c.value)),
    [documents],
  );

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (documents.length + list.length > MAX_DOCS_PER_STUDENT) {
      toast.error(`Max ${MAX_DOCS_PER_STUDENT} documents per student.`);
      return;
    }
    for (const f of list) {
      const tempId = `${Date.now()}-${f.name}`;
      setUploading((u) => [...u, { id: tempId, name: f.name, progress: 10 }]);
      const interval = setInterval(() => {
        setUploading((u) =>
          u.map((x) => (x.id === tempId && x.progress < 85 ? { ...x, progress: x.progress + 15 } : x)),
        );
      }, 250);
      try {
        await upload.mutateAsync({ file: f, category, description });
        setUploading((u) => u.map((x) => (x.id === tempId ? { ...x, progress: 100 } : x)));
      } catch {
        // toast handled in hook
      } finally {
        clearInterval(interval);
        setTimeout(() => setUploading((u) => u.filter((x) => x.id !== tempId)), 400);
      }
    }
    setDescription('');
    toast.success('Upload complete');
  };

  const openDocument = async (doc: StudentDocument) => {
    const url = await getStudentDocumentUrl(doc.file_path);
    if (!url) {
      toast.error('Could not open file');
      return;
    }
    if (doc.mime_type?.startsWith('image/')) {
      setPreview({ url, name: doc.file_name });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const downloadDocument = async (doc: StudentDocument) => {
    const url = await getStudentDocumentUrl(doc.file_path);
    if (!url) {
      toast.error('Could not download file');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.file_name;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Documents
          {documents.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({documents.length})</span>
          )}
        </CardTitle>
        <CardDescription>
          IDs, receipts, resumes, and other paperwork kept with this student's file. Staff only —
          participants never see these. Max {MAX_DOCS_PER_STUDENT} files, 10 MB each.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Upload controls */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-medium" htmlFor="doc-category">
              Category
            </label>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
              <SelectTrigger id="doc-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-medium" htmlFor="doc-description">
              Description (optional)
            </label>
            <Input
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. State ID, front and back"
              maxLength={200}
            />
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
          }}
          className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors sm:p-6 ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border'
          }`}
        >
          <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mb-1 text-sm text-muted-foreground">Drag &amp; drop files here, or</p>
          <p className="mb-3 text-xs text-muted-foreground">Accepted: {ACCEPTED_LABEL}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending || documents.length >= MAX_DOCS_PER_STUDENT}
            className="min-h-[44px]"
            aria-label="Choose files to upload"
          >
            {upload.isPending ? 'Uploading...' : 'Choose files'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_DOC_MIME.join(',')}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {/* In-progress uploads */}
        {uploading.length > 0 && (
          <ul className="space-y-2" aria-live="polite">
            {uploading.map((u) => (
              <li key={u.id} className="rounded-md border border-border p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{u.name}</span>
                  <span className="flex-shrink-0 text-xs text-muted-foreground">{u.progress}%</span>
                </div>
                <Progress value={u.progress} className="h-1.5" />
              </li>
            ))}
          </ul>
        )}

        {/* Category filter */}
        {usedCategories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              All ({documents.length})
            </Button>
            {usedCategories.map((c) => (
              <Button
                key={c.value}
                type="button"
                size="sm"
                variant={filter === c.value ? 'default' : 'outline'}
                onClick={() => setFilter(c.value)}
              >
                {c.label} ({documents.filter((d) => d.category === c.value).length})
              </Button>
            ))}
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading...</p>
        ) : visible.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            {documents.length === 0
              ? 'No documents yet. Upload the first one above.'
              : 'No documents in this category.'}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {visible.map((doc) => {
              const Icon = getIcon(doc.mime_type);
              return (
                <li key={doc.id} className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => openDocument(doc)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-80"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.file_name}</p>
                      {doc.description && (
                        <p className="truncate text-xs text-muted-foreground">{doc.description}</p>
                      )}
                      <p className="truncate text-xs text-muted-foreground">
                        {formatBytes(doc.file_size)}
                        {doc.uploader_name ? ` · ${doc.uploader_name}` : ''}
                        {' · '}
                        {format(new Date(doc.created_at), 'PP')}
                      </p>
                    </div>
                  </button>
                  <Badge variant="secondary" className="hidden flex-shrink-0 sm:inline-flex">
                    {categoryLabel(doc.category)}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => downloadDocument(doc)}
                    aria-label={`Download ${doc.file_name}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete(doc) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove.mutate(doc)}
                      disabled={remove.isPending}
                      aria-label={`Delete ${doc.file_name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* Image preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && <img src={preview.url} alt={preview.name} className="h-auto w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
