import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FileText, CalendarDays, Loader2, Mail, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { startQRSession, logQREvent } from '@/hooks/useQRSession';

interface QRCodeData {
  id: string;
  code: string;
  label: string;
  organization_id: string | null;
  is_active: boolean;
  destination_type: 'request' | 'meeting' | 'external';
  destination_url: string | null;
  title: string | null;
  description: string | null;
  prefill_category: string | null;
}

export default function QRLanding() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const { user, role, isLoading } = useAuth();
  const [qrCode, setQrCode] = useState<QRCodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data, error } = await supabase
        .from('qr_codes')
        .select('id,code,label,organization_id,is_active,destination_type,destination_url,title,description,prefill_category')
        .eq('code', code)
        .maybeSingle();
      if (error || !data || !data.is_active) {
        setError('This QR code is invalid or no longer active.');
        setLoading(false);
        return;
      }
      setQrCode(data as QRCodeData);
      const sessionId = startQRSession(data.id);
      await logQREvent({ eventType: 'scan', qrCodeId: data.id, sessionId });
      setLoading(false);
    })();
  }, [code]);

  useEffect(() => {
    if (!qrCode || isLoading) return;
    if (user) {
      logQREvent({ eventType: 'auth_completed' });
      // Auto-forward signed-in students to the standalone request page.
      if (
        qrCode.destination_type === 'request' &&
        (!role || role === 'student')
      ) {
        navigate(`/qr/${qrCode.code}/request`, { replace: true });
      }
    }
  }, [qrCode, user, role, isLoading, navigate]);

  const isStaff = !!role && role !== 'student';

  const buildRequestPath = () => {
    const qp = new URLSearchParams({ source: 'qr', qr: qrCode!.code });
    return `/student/support-request?${qp.toString()}`;
  };

  // Auto-redirect external destinations
  useEffect(() => {
    if (!qrCode || qrCode.destination_type !== 'external' || !qrCode.destination_url) return;
    if (params.get('go') === '0') return; // allow preview without bouncing
    (async () => {
      await logQREvent({ eventType: 'action_selected', actionKind: 'request' });
      window.location.replace(qrCode.destination_url!);
    })();
  }, [qrCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (kind: 'request' | 'meeting') => {
    await logQREvent({ eventType: 'action_selected', actionKind: kind });
    if (kind === 'request' && user && isStaff) return;
    if (!user) {
      await logQREvent({ eventType: 'auth_required', actionKind: kind });
      const next = kind === 'request' ? buildRequestPath() : '/dashboard?action=schedule';
      navigate(`/auth?redirect=${encodeURIComponent(next)}&remember=1`);
      return;
    }
    if (kind === 'meeting' && isStaff) {
      navigate('/dashboard');
      return;
    }
    if (kind === 'request') navigate(buildRequestPath());
    else navigate('/dashboard?action=schedule');
  };

  const handleMagicLink = async () => {
    if (!email.trim() || !qrCode) return;
    setSendingLink(true);
    try {
      await logQREvent({ eventType: 'auth_required', actionKind: 'request' });
      const redirectTo = `${window.location.origin}/qr/${qrCode.code}?verified=1`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) throw error;
      setLinkSent(true);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not send link', description: e.message });
    } finally {
      setSendingLink(false);
    }
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

  if (!qrCode) return null;

  const headline = qrCode.title || 'How can we help today?';
  const subline = qrCode.description || qrCode.label;
  const isExternal = qrCode.destination_type === 'external';
  const isRequestOnly = qrCode.destination_type === 'request';
  const isMeetingOnly = qrCode.destination_type === 'meeting';

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/5 to-background p-6">
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col justify-center space-y-8">
        <div className="text-center space-y-3">
          <img
            src="https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp"
            alt="Evolve Foundation"
            className="h-12 mx-auto"
          />
          <h1 className="font-display text-2xl font-bold">{headline}</h1>
          {subline && <p className="text-sm text-muted-foreground">{subline}</p>}
        </div>

        {isStaff && !isMeetingOnly && (
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-100 text-center">
            Submitting a support request is for students only. You're signed in as staff.
          </div>
        )}

        {isExternal ? (
          <div className="space-y-3 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Redirecting…</p>
            <Button asChild variant="outline" className="rounded-full">
              <a href={qrCode.destination_url!} rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Continue
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!isMeetingOnly && (
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
            )}

            {!isRequestOnly && (
              <Button
                size="lg"
                variant={isMeetingOnly ? 'default' : 'outline'}
                className="w-full h-auto py-6 rounded-full text-base flex flex-col items-center gap-2 border-2"
                onClick={() => handleAction('meeting')}
              >
                <CalendarDays className="h-7 w-7" />
                <span className="font-semibold">Schedule a Meeting</span>
                <span className="text-xs font-normal text-muted-foreground">Book time with your case manager</span>
              </Button>
            )}

            {isStaff && (
              <Button variant="ghost" className="w-full rounded-full" onClick={() => navigate('/dashboard')}>
                Go to dashboard
              </Button>
            )}
          </div>
        )}

        {!user && !isExternal && !isStaff && (
          <Card className="border-dashed">
            <CardContent className="p-5 space-y-3">
              {linkSent ? (
                <div className="text-center space-y-2">
                  <Mail className="h-6 w-6 mx-auto text-primary" />
                  <p className="text-sm font-medium">Check your email</p>
                  <p className="text-xs text-muted-foreground">
                    We sent a secure link to <strong>{email}</strong>. Open it on this device to continue.
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <p className="text-sm font-medium">New here? Continue with email</p>
                    <p className="text-xs text-muted-foreground mt-1">We'll send you a one-tap sign-in link.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qr-email" className="sr-only">Email</Label>
                    <Input
                      id="qr-email"
                      type="email"
                      placeholder="you@school.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-full"
                    />
                    <Button
                      onClick={handleMagicLink}
                      disabled={sendingLink || !email.trim()}
                      className="w-full rounded-full"
                      variant="outline"
                    >
                      {sendingLink && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send sign-in link
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!user && !isExternal && (
          <p className="text-center text-xs text-muted-foreground">
            Or use "Submit a Request" above to sign in with your existing account.
          </p>
        )}
      </div>
    </div>
  );
}
