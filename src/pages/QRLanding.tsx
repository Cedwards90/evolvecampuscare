import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, CalendarDays, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { startQRSession, logQREvent } from '@/hooks/useQRSession';

export default function QRLanding() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, role, isLoading } = useAuth();
  const [qrCode, setQrCode] = useState<{ id: string; label: string; organization_id: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data, error } = await supabase
        .from('qr_codes')
        .select('id,label,organization_id,is_active')
        .eq('code', code)
        .maybeSingle();
      if (error || !data || !data.is_active) {
        setError('This QR code is invalid or no longer active.');
        setLoading(false);
        return;
      }
      setQrCode(data);
      const sessionId = startQRSession(data.id);
      await logQREvent({ eventType: 'scan', qrCodeId: data.id, sessionId });
      setLoading(false);
    })();
  }, [code]);

  useEffect(() => {
    if (!qrCode || isLoading) return;
    if (user) {
      // Just-logged-in path: log auth_completed once per session
      logQREvent({ eventType: 'auth_completed' });
    }
  }, [qrCode, user, isLoading]);

  const isStaff = !!role && role !== 'student';

  const handleAction = async (kind: 'request' | 'meeting') => {
    await logQREvent({ eventType: 'action_selected', actionKind: kind });
    // Staff are not permitted to submit a request via the student flow.
    if (kind === 'request' && user && isStaff) {
      return;
    }
    if (!user) {
      await logQREvent({ eventType: 'auth_required', actionKind: kind });
      const next = kind === 'request'
        ? '/student/support-request?source=qr'
        : '/dashboard?action=schedule';
      navigate(`/auth?redirect=${encodeURIComponent(next)}&remember=1`);
      return;
    }
    if (kind === 'meeting' && isStaff) {
      navigate('/dashboard');
      return;
    }
    if (kind === 'request') navigate('/student/support-request?source=qr');
    else navigate('/dashboard?action=schedule');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <h1 className="font-display text-xl font-semibold">QR Code Unavailable</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button asChild className="rounded-full"><a href="/">Go to homepage</a></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/5 to-background p-6">
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col justify-center space-y-8">
        <div className="text-center space-y-3">
          <img
            src="https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp"
            alt="Evolve Foundation"
            className="h-12 mx-auto"
          />
          <h1 className="font-display text-2xl font-bold">How can we help today?</h1>
          {qrCode && <p className="text-sm text-muted-foreground">{qrCode.label}</p>}
        </div>

        {isStaff && (
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-100 text-center">
            Submitting a support request is for students only. You're signed in as staff.
          </div>
        )}

        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full h-auto py-6 rounded-full text-base flex flex-col items-center gap-2 disabled:opacity-50"
            onClick={() => handleAction('request')}
            disabled={isStaff}
          >
            <FileText className="h-7 w-7" />
            <span className="font-semibold">Submit a Request</span>
            <span className="text-xs font-normal opacity-90">Academic, financial, housing, mental health & more</span>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full h-auto py-6 rounded-full text-base flex flex-col items-center gap-2 border-2"
            onClick={() => handleAction('meeting')}
          >
            <CalendarDays className="h-7 w-7" />
            <span className="font-semibold">Schedule a Meeting</span>
            <span className="text-xs font-normal text-muted-foreground">Book time with your case manager</span>
          </Button>

          {isStaff && (
            <Button
              variant="ghost"
              className="w-full rounded-full"
              onClick={() => navigate('/dashboard')}
            >
              Go to dashboard
            </Button>
          )}
        </div>

        {!user && (
          <p className="text-center text-xs text-muted-foreground">
            You'll be asked to sign in once. We'll remember this device for next time.
          </p>
        )}
      </div>
    </div>
  );
}
