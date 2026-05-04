import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function QRRequestSuccess() {
  const { code } = useParams<{ code: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requestId = params.get('id');

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/5 to-background p-6">
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col justify-center">
        <div className="text-center space-y-4 mb-6">
          <img
            src="https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp"
            alt="Evolve Foundation"
            className="h-10 mx-auto"
          />
        </div>
        <Card className="border-primary/20">
          <CardContent className="p-8 space-y-6 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-bold">Request submitted</h1>
              <p className="text-sm text-muted-foreground">
                Your request has been added to your student file. A case manager will review it shortly.
              </p>
              {requestId && (
                <p className="text-xs text-muted-foreground pt-1">
                  Reference: <span className="font-mono">{requestId.slice(0, 8)}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              {requestId && (
                <Button
                  className="w-full rounded-full"
                  size="lg"
                  onClick={() => navigate(`/requests/${requestId}`)}
                >
                  View status
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full rounded-full"
                onClick={() => navigate(`/qr/${code}/request`, { replace: true })}
              >
                Submit another
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-full"
                onClick={() => navigate('/dashboard')}
              >
                Go to dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
