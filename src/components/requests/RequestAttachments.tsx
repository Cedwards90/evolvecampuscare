import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Paperclip, Upload, Download, Trash2, FileText, Image as ImageIcon, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import {
  useRequestAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  getAttachmentSignedUrl,
  MAX_FILE_SIZE,
  MAX_FILES_PER_REQUEST,
  ALLOWED_MIME_TYPES,
  type RequestAttachment,
} from '@/hooks/useRequestAttachments';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  requestId: string;
}

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

export function RequestAttachments({ requestId }: Props) {
  const { user } = useAuth();
  const { data: attachments = [], isLoading } = useRequestAttachments(requestId);
  const upload = useUploadAttachment(requestId);
  const remove = useDeleteAttachment(requestId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (attachments.length + list.length > MAX_FILES_PER_REQUEST) {
      toast.error(`Max ${MAX_FILES_PER_REQUEST} files per request.`);
      return;
    }
    for (const f of list) {
      await upload.mutateAsync(f).catch(() => {});
    }
  };

  const openAttachment = async (att: RequestAttachment) => {
    const url = await getAttachmentSignedUrl(att.file_path);
    if (!url) {
      toast.error('Could not open file');
      return;
    }
    if (att.mime_type?.startsWith('image/')) {
      setPreview({ url, name: att.file_name });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const downloadAttachment = async (att: RequestAttachment) => {
    const url = await getAttachmentSignedUrl(att.file_path);
    if (!url) {
      toast.error('Could not download file');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = att.file_name;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          Attachments
          {attachments.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({attachments.length})</span>
          )}
        </CardTitle>
        <CardDescription>
          Receipts, invoices, photos, or supporting documents. Max {MAX_FILES_PER_REQUEST} files, 10 MB each.
          You can add attachments at any time, including after a request is resolved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
          }}
          className={`rounded-lg border-2 border-dashed p-4 sm:p-6 text-center transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border'
          }`}
        >
          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-3">
            Drag & drop files here, or
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending || attachments.length >= MAX_FILES_PER_REQUEST}
            className="min-h-[44px]"
          >
            {upload.isPending ? 'Uploading...' : 'Choose files'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_MIME_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {/* List */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">No attachments yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {attachments.map((att) => {
              const Icon = getIcon(att.mime_type);
              const canDelete = user?.id === att.uploaded_by;
              return (
                <li key={att.id} className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => openAttachment(att)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80"
                  >
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{att.file_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatBytes(att.file_size)}
                        {att.uploader_name ? ` · ${att.uploader_name}` : ''}
                        {' · '}{format(new Date(att.created_at), 'PP')}
                      </p>
                    </div>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => downloadAttachment(att)}
                    aria-label="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove.mutate(att)}
                      disabled={remove.isPending}
                      aria-label="Delete"
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <img
              src={preview.url}
              alt={preview.name}
              className="w-full h-auto rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
