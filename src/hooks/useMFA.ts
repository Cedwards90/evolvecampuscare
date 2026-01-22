import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Factor } from '@supabase/supabase-js';

interface MFAState {
  isEnrolled: boolean;
  isVerified: boolean;
  factors: Factor[];
  isLoading: boolean;
  requiresVerification: boolean;
}

export function useMFA() {
  const [state, setState] = useState<MFAState>({
    isEnrolled: false,
    isVerified: false,
    factors: [],
    isLoading: true,
    requiresVerification: false,
  });

  const checkMFAStatus = useCallback(async () => {
    try {
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) throw factorsError;
      
      const verifiedFactors = factorsData.totp.filter(f => f.status === 'verified');
      const isEnrolled = verifiedFactors.length > 0;
      
      // Check if MFA verification is needed for the current session
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (aalError) throw aalError;
      
      // User needs to verify MFA if they have enrolled factors but current AAL < next AAL
      const requiresVerification = isEnrolled && aalData.currentLevel !== aalData.nextLevel;
      
      setState({
        isEnrolled,
        isVerified: !requiresVerification,
        factors: factorsData.totp,
        isLoading: false,
        requiresVerification,
      });
    } catch (error) {
      console.error('Error checking MFA status:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    checkMFAStatus();
  }, [checkMFAStatus]);

  const unenroll = async (factorId: string) => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await checkMFAStatus();
      return { error: null };
    } catch (error) {
      console.error('Error unenrolling MFA:', error);
      return { error };
    }
  };

  return {
    ...state,
    checkMFAStatus,
    unenroll,
  };
}
