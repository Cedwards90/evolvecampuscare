/**
 * Explicit draft state for the user: Saved locally / Synced / Sync failed.
 *
 * In-progress support, intake, and crisis-related content is sensitive enough
 * that "it looked saved" is not good enough — the user always sees whether the
 * work has reached the server, and can retry or resolve a cross-device
 * conflict without losing either copy.
 */

import { AlertTriangle, Check, CloudOff, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DraftSyncState } from '@/hooks/useFormPersistence';

interface DraftStatusProps {
  syncState: DraftSyncState;
  savedAt: string | null;
  onRetry?: () => void;
  className?: string;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function DraftStatus({ syncState, savedAt, onRetry, className }: DraftStatusProps) {
  if (syncState === 'idle' && !savedAt) return null;

  const time = formatTime(savedAt);

  if (syncState === 'saving') {
    return (
      <p className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)} role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Saving your progress…
      </p>
    );
  }

  if (syncState === 'failed') {
    return (
      <div
        className={cn('flex flex-wrap items-center gap-2 text-xs text-destructive', className)}
        role="alert"
      >
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          Saved on this device only — sync to our servers failed.
        </span>
        {onRetry && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 rounded-full px-2 text-xs"
            onClick={onRetry}
          >
            <RefreshCw className="mr-1 h-3 w-3" aria-hidden="true" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (syncState === 'synced') {
    return (
      <p className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)} role="status">
        <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" aria-hidden="true" />
        Synced{time ? ` at ${time}` : ''} — available on your other devices.
      </p>
    );
  }

  // 'local' — persisted on this device, server copy still pending.
  return (
    <p className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)} role="status">
      <Smartphone className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      Saved on this device{time ? ` at ${time}` : ''} — syncing shortly.
    </p>
  );
}

interface DraftConflictNoticeProps {
  conflict: { savedAt: string } | null;
  onUseRemote: () => void;
  onKeepLocal: () => void;
  className?: string;
}

/**
 * Both drafts are preserved. Nothing is discarded until the user chooses, so a
 * second device can never silently overwrite work in progress.
 */
export function DraftConflictNotice({
  conflict,
  onUseRemote,
  onKeepLocal,
  className,
}: DraftConflictNoticeProps) {
  if (!conflict) return null;

  return (
    <div
      className={cn(
        'rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm',
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <CloudOff className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0 space-y-2">
          <p className="font-semibold">A newer draft exists on another device</p>
          <p className="text-muted-foreground">
            That copy was saved {new Date(conflict.savedAt).toLocaleString()}. Both versions are
            still stored — choose which one to continue with.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" className="rounded-full" onClick={onUseRemote}>
              Use the newer draft
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={onKeepLocal}
            >
              Keep what's on this device
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
