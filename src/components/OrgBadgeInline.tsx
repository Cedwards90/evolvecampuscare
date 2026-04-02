import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

interface OrgBadgeProps {
  orgId: string;
  linkable?: boolean;
}

export function OrgBadgeInline({ orgId, linkable = true }: OrgBadgeProps) {
  const { data: org } = useQuery({
    queryKey: ['org-name', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_organizations')
        .select('id, name')
        .eq('id', orgId)
        .single();
      if (error) return null;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  if (!org) return null;

  const badge = (
    <Badge variant="outline" className="gap-1 text-xs">
      <Building2 className="h-3 w-3" />
      {org.name}
    </Badge>
  );

  if (linkable) {
    return <Link to={`/admin/organizations/${org.id}`}>{badge}</Link>;
  }

  return badge;
}
