import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Copy, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MFAEnrollmentProps {
  onEnrollmentComplete: () => void;
  onSkip?: () => void;
}

export function MFAEnrollment({ onEnrollmentComplete, onSkip }: MFAEnrollmentProps) {
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    enrollMFA();
  }, []);

  const enrollMFA = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
      }
    } catch (err) {
      console.error('MFA enrollment error:', err);
      setError('Failed to initialize MFA enrollment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      toast({
        title: 'MFA Enabled',
        description: 'Two-factor authentication has been successfully enabled for your account.',
      });

      onEnrollmentComplete();
    } catch (err: unknown) {
      console.error('MFA verification error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Invalid verification code. Please try again.';
      setError(errorMessage);
      setVerifyCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied',
      description: 'Secret key copied to clipboard',
    });
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
        <CardTitle>Set Up Two-Factor Authentication</CardTitle>
        <CardDescription>
          Add an extra layer of security to your account by enabling MFA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Step 1: Scan QR Code</p>
            <p>Open your authenticator app (Google Authenticator, Authy, etc.) and scan this QR code:</p>
          </div>
          
          {qrCode && (
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Or enter this secret manually:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono">
                {secret}
              </code>
              <Button variant="outline" size="icon" onClick={copySecret}>
                {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Step 2: Enter Verification Code</p>
            <p>Enter the 6-digit code from your authenticator app:</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="verify-code">Verification Code</Label>
            <Input
              id="verify-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest font-mono"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleVerify} 
            disabled={isVerifying || verifyCode.length !== 6}
            className="w-full"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Enable MFA'
            )}
          </Button>
          
          {onSkip && (
            <Button variant="ghost" onClick={onSkip} className="w-full">
              Skip for now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
