import { Check, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DraftIndicatorProps {
  savedAt: string | null;
  hasDraft: boolean;
  onDiscard?: () => void;
  className?: string;
}

/**
 * Tiny inline indicator that shows when a form has an auto-saved draft.
 * Meant to sit next to submit buttons.
 */
export function DraftIndicator({ savedAt, hasDraft, onDiscard, className }: DraftIndicatorProps) {
  if (!hasDraft && !savedAt) return null;

  let label = 'Draft saved';
  if (savedAt) {
    try {
      label = `Draft saved ${formatDistanceToNow(new Date(savedAt), { addSuffix: true })}`;
    } catch {
      /* keep default */
    }
  }

  return (
    <div className={`inline-flex items-center gap-2 text-xs text-muted-foreground ${className ?? ''}`}>
      <span className="inline-flex items-center gap-1">
        <Check className="h-3 w-3 text-success" aria-hidden />
        {label}
      </span>
      {onDiscard && (
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-muted hover:text-foreground transition-colors"
        >
          <Trash2 className="h-3 w-3" aria-hidden />
          Discard draft
        </button>
      )}
    </div>
  );
}
