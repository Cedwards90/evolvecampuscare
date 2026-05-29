import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSuspendedOrgIds } from '@/hooks/useSuspendedOrgIds';

interface Props {
  organizationId?: string | null;
  className?: string;
}

/**
 * Small destructive pill shown on list rows whose organization is suspended.
 * Renders nothing if the org isn't suspended or no id is provided.
 */
export function SuspendedOrgBadge({ organizationId, className }: Props) {
  const { data } = useSuspendedOrgIds();
  if (!organizationId || !data?.has(organizationId)) return null;
  return (
    <Badge variant="destructive" className={`gap-1 text-[10px] ${className || ''}`}>
      <AlertTriangle className="h-3 w-3" />
      Suspended org
    </Badge>
  );
}
