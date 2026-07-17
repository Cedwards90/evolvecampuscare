import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfileAudit } from '@/hooks/useEditProfile';

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Display name',
  legal_first_name: 'Legal first name',
  legal_last_name: 'Legal last name',
  preferred_name: 'Preferred name',
  email: 'Email',
  phone: 'Phone',
  date_of_birth: 'Date of birth',
  address_line1: 'Address line 1',
  address_line2: 'Address line 2',
  city: 'City',
  state_region: 'State/Region',
  postal_code: 'Postal code',
  country: 'Country',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  targetLabel?: string;
}

export function ProfileAuditDialog({ open, onOpenChange, userId, targetLabel }: Props) {
  const { data: entries = [], isLoading } = useProfileAudit(open ? userId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Profile edit history{targetLabel ? ` — ${targetLabel}` : ''}</DialogTitle>
          <DialogDescription>
            Every field-level change to this profile is logged automatically.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No profile edits recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {entries.map((e) => (
                <li key={e.id} className="p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{format(new Date(e.created_at), 'PPpp')}</span>
                    <span className="truncate">
                      {e.actor_name || e.actor_email || 'System'}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{FIELD_LABELS[e.field] || e.field}</span>
                    <span className="text-muted-foreground"> changed from </span>
                    <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                      {e.old_value ?? '—'}
                    </span>
                    <span className="text-muted-foreground"> to </span>
                    <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                      {e.new_value ?? '—'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
