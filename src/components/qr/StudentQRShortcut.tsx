import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QRPosterPreview } from './QRPosterPreview';
import { QrCode } from 'lucide-react';

export function StudentQRShortcut() {
  const { profile } = useAuth();
  const [qr, setQr] = useState<{ code: string; label: string; org?: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      // Pick the QR for the student's org, else the most recent active one they can read
      const orgId = profile?.organization_id;
      let q = supabase.from('qr_codes').select('code,label,organization_id').eq('is_active', true).limit(1);
      if (orgId) q = q.eq('organization_id', orgId);
      const { data } = await q.maybeSingle();
      if (data) setQr({ code: data.code, label: data.label, org: data.organization_id });
    })();
  }, [profile?.organization_id]);

  if (!qr) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          Quick Access QR
        </CardTitle>
        <CardDescription>
          Save or print this code for fast access from your phone — submit a request or schedule a meeting in one tap.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QRPosterPreview code={qr.code} label={qr.label} />
      </CardContent>
    </Card>
  );
}
