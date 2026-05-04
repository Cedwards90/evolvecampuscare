import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import SubmitRequest from './SubmitRequest';

export default function QRStandaloneRequest() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, role, isLoading } = useAuth();
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data } = await supabase
        .from('qr_codes')
        .select('id,is_active,destination_type')
        .eq('code', code)
        .maybeSingle();
      if (!data || !data.is_active || data.destination_type !== 'request') {
        navigate(`/qr/${code}`, { replace: true });
        return;
      }
      setValidating(false);
    })();
  }, [code, navigate]);

  // Require an authenticated student session to actually submit.
  useEffect(() => {
    if (isLoading || validating) return;
    if (!user) {
      navigate(`/qr/${code}`, { replace: true });
      return;
    }
    if (role && role !== 'student') {
      navigate(`/qr/${code}`, { replace: true });
    }
  }, [user, role, isLoading, validating, code, navigate]);

  if (validating || isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-center">
          <img
            src="https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp"
            alt="Evolve Foundation"
            className="h-9"
          />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <SubmitRequest standalone qrCodeOverride={code} />
      </main>
    </div>
  );
}
