import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Lock,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SafeRichText } from '@/components/ui/SafeRichText';
import type { RequestUpdate, Profile, RequestStatus } from '@/types/database';

interface RequestTimelineProps {
  updates: (RequestUpdate & { user: Profile | null })[];
  showInternal: boolean;
  requestId?: string;
}

const statusIcons: Record<RequestStatus, React.ComponentType<{ className?: string }>> = {
  submitted: Clock,
  in_progress: ArrowRight,
  escalated: AlertTriangle,
  resolved: CheckCircle,
  cancelled: XCircle,
};

const statusColors: Record<RequestStatus, string> = {
  submitted: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  escalated: 'bg-orange-500',
  resolved: 'bg-green-500',
  cancelled: 'bg-red-500',
};

export function RequestTimeline({ updates, showInternal, requestId }: RequestTimelineProps) {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filteredUpdates = showInternal
    ? updates
    : updates.filter(u => !u.is_internal);

  const canDelete = (update: RequestUpdate) => {
    if (!user) return false;
    if (role === 'admin') return true;
    if (role === 'case_manager' && update.user_id === user.id) return true;
    return false;
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('request_updates').delete().eq('id', id);
    setDeletingId(null);
    setPendingDelete(null);
    if (error) {
      toast.error('Failed to delete entry: ' + error.message);
      return;
    }
    toast.success('Activity entry deleted');
    if (requestId) {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
    }
    queryClient.invalidateQueries({ queryKey: ['request-updates'] });
  };

  if (filteredUpdates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No activity yet
      </div>
    );
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-4">
      {filteredUpdates.map((update, index) => {
        const isStatusChange = update.new_status !== null;
        const StatusIcon = update.new_status ? statusIcons[update.new_status] : MessageSquare;

        return (
          <div key={update.id} className="flex gap-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                update.is_internal 
                  ? "bg-amber-100 dark:bg-amber-900/30" 
                  : isStatusChange && update.new_status
                    ? statusColors[update.new_status]
                    : "bg-primary"
              )}>
                {update.is_internal ? (
                  <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <StatusIcon className={cn(
                    "h-4 w-4",
                    isStatusChange ? "text-white" : "text-primary-foreground"
                  )} />
                )}
              </div>
              {index < filteredUpdates.length - 1 && (
                <div className="w-px flex-1 bg-border mt-2" />
              )}
            </div>

            {/* Content */}
            <div className={cn(
              "flex-1 min-w-0 pb-4 rounded-lg p-4",
              update.is_internal 
                ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" 
                : "bg-muted/50"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {getInitials(update.user?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm">
                  {update.user?.full_name || 'Unknown User'}
                </span>
                {update.is_internal && (
                  <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Internal
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                </span>
                {canDelete(update) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingDelete(update.id)}
                    disabled={deletingId === update.id}
                    aria-label="Delete activity entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {isStatusChange && update.previous_status && update.new_status && (
                <div className="flex items-center gap-2 mb-2 text-sm">
                  <Badge variant="secondary" className="capitalize">
                    {update.previous_status.replace('_', ' ')}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="secondary" className="capitalize">
                    {update.new_status.replace('_', ' ')}
                  </Badge>
                </div>
              )}

              {update.note && (
                <SafeRichText
                  text={update.note}
                  clampLines={6}
                  showCopy
                  className="text-sm text-foreground"
                />
              )}
            </div>
          </div>
        );
      })}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete activity entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes this entry from the activity timeline. This action cannot be undone. The request status itself will not change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && handleDelete(pendingDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
