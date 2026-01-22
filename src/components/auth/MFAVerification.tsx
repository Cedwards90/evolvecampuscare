import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2 } from 'lucide-react';

interface MFAVerificationProps {
  onVerificationComplete: () => void;
  onCancel?: () => void;
}

export function MFAVerification({ onVerificationComplete, onCancel }: MFAVerificationProps) {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMFAFactors();
  }, []);

  const fetchMFAFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) throw error;
      
      // Find the first verified TOTP factor
      const totpFactor = data.totp.find(f => f.status === 'verified');
      
      if (totpFactor) {
        setFactorId(totpFactor.id);
      } else {
        setError('No MFA factor found. Please contact support.');
      }
    } catch (err) {
      console.error('Error fetching MFA factors:', err);
      setError('Failed to load MFA configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6 || !factorId) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      // Verify the challenge with the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      onVerificationComplete();
    } catch (err: unknown) {
      console.error('MFA verification error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Invalid code. Please try again.';
      setError(errorMessage);
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleVerify();
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="mfa-code">Authentication Code</Label>
          <Input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyPress={handleKeyPress}
            className="text-center text-2xl tracking-widest font-mono"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleVerify} 
            disabled={isVerifying || code.length !== 6}
            className="w-full"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>
          
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} className="w-full">
              Cancel
            </Button>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Open your authenticator app (Google Authenticator, Authy, etc.) 
          to view your authentication code.
        </p>
      </CardContent>
    </Card>
  );
}
