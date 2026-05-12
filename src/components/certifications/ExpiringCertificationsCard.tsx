import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Award } from 'lucide-react';
import { differenceInDays, format, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useExpiringCertifications } from '@/hooks/useStudentCertifications';
import { useCertificationCatalog } from '@/hooks/useCertificationCatalog';
import { supabase } from '@/integrations/supabase/client';

export function ExpiringCertificationsCard({ days = 90 }: { days?: number }) {
  const { data: certs = [], isLoading } = useExpiringCertifications(days);
  const { entries } = useCertificationCatalog({ activeOnly: false });

  const studentIds = useMemo(() => Array.from(new Set(certs.map((c) => c.student_id))), [certs]);
  const { data: profiles = [] } = useQuery({
    queryKey: ['expiring-cert-profiles', studentIds.sort().join(',')],
    queryFn: async () => {
      if (studentIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', studentIds);
      if (error) throw error;
      return data || [];
    },
    enabled: studentIds.length > 0,
  });

  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
  const catalogMap = new Map(entries.map((e) => [e.id, e]));

  if (isLoading || certs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Certifications expiring soon
        </CardTitle>
        <CardDescription>Within the next {days} days.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {certs.slice(0, 8).map((c) => {
            const days = differenceInDays(parseISO(c.expiration_date!), new Date());
            const name = c.catalog_id ? catalogMap.get(c.catalog_id)?.name ?? 'Certification' : c.custom_name ?? 'Certification';
            const profile = profileMap.get(c.student_id);
            return (
              <Link
                key={c.id}
                to={`/students/${c.student_id}`}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {profile?.full_name || profile?.email || 'Student'}
                  </div>
                </div>
                <Badge variant={days <= 14 ? 'destructive' : 'outline'} className="shrink-0">
                  {days <= 0 ? 'Expired' : `${days}d · ${format(parseISO(c.expiration_date!), 'MMM d')}`}
                </Badge>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
