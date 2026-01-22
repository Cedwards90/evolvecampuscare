// Shared security utilities for edge functions
// deno-lint-ignore-file no-explicit-any

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Allowed origins for CORS - restrict to known domains
const ALLOWED_ORIGINS = [
  'https://evolvecampuscare.lovable.app',
  'https://id-preview--566d8616-fbe5-4c84-8ac9-0bfd7fde3b97.lovable.app',
  'https://kxhykddsllizazoqxevu.supabase.co',
];

// For development, optionally allow localhost
const isDev = Deno.env.get('DENO_ENV') === 'development';
if (isDev) {
  ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:3000');
}

/**
 * Generate CORS headers with origin validation
 * Only allows requests from whitelisted origins
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0]; // Default to primary domain

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Sanitize error messages to prevent information leakage
 * Logs full error server-side, returns safe message to client
 */
export function sanitizeError(error: unknown, context: string): string {
  // Generate request ID for support correlation
  const requestId = crypto.randomUUID().slice(0, 8);
  
  // Log full error details server-side
  console.error(`[${context}][${requestId}]`, error);

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Map known error patterns to safe messages
    if (message.includes('not found') || message.includes('no rows')) {
      return 'Resource not found';
    }
    if (message.includes('permission') || message.includes('forbidden') || message.includes('denied')) {
      return 'Access denied';
    }
    if (message.includes('duplicate') || message.includes('unique') || message.includes('already exists')) {
      return 'Resource already exists';
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return 'Invalid request data';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'Request timed out. Please try again';
    }
    if (message.includes('rate limit') || message.includes('too many')) {
      return 'Too many requests. Please wait and try again';
    }
    if (message.includes('mfa') || message.includes('aal2')) {
      return 'Multi-factor authentication required';
    }
  }

  // Generic fallback - don't reveal internal details
  return `An error occurred. Reference: ${requestId}`;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  
  return result === 0;
}

/**
 * Validate CRON_SECRET for scheduled functions
 * Requires secret to be set and at least 32 characters
 */
export function validateCronSecret(providedSecret: string | null): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  
  // Secret must be configured and strong enough
  if (!cronSecret || cronSecret.length < 32) {
    console.error('CRON_SECRET not configured or too weak (must be 32+ characters)');
    return false;
  }
  
  if (!providedSecret) {
    return false;
  }
  
  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(providedSecret, cronSecret);
}

/**
 * Create a standardized error response with sanitized message
 */
export function createErrorResponse(
  error: unknown,
  context: string,
  statusCode: number,
  corsHeaders: Record<string, string>
): Response {
  const safeMessage = sanitizeError(error, context);
  
  return new Response(
    JSON.stringify({ error: safeMessage }),
    {
      status: statusCode,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  );
}

/**
 * Privileged roles that require MFA (AAL2) verification
 */
export const PRIVILEGED_ROLES = ['admin', 'case_manager'] as const;
export type PrivilegedRole = typeof PRIVILEGED_ROLES[number];

/**
 * Result of MFA verification check
 */
export interface MFAVerificationResult {
  verified: boolean;
  error?: string;
  currentLevel?: string;
  nextLevel?: string;
}

/**
 * Verify that a privileged user has completed MFA (AAL2) authentication.
 * This provides server-side enforcement of MFA for admin and case_manager roles.
 * 
 * @param authClient - Supabase client authenticated with user's token
 * @param userRole - The user's role (admin, case_manager, student)
 * @returns MFAVerificationResult indicating whether MFA is verified
 */
export async function verifyMFAForPrivilegedRole(
  authClient: SupabaseClient,
  userRole: string
): Promise<MFAVerificationResult> {
  // Students don't require MFA
  if (!PRIVILEGED_ROLES.includes(userRole as PrivilegedRole)) {
    return { verified: true };
  }

  try {
    // Check the user's Authenticator Assurance Level (AAL)
    const { data: aalData, error: aalError } = await authClient.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      console.error('Error checking MFA status:', aalError);
      return { 
        verified: false, 
        error: 'Failed to verify MFA status' 
      };
    }

    if (!aalData) {
      return { 
        verified: false, 
        error: 'MFA status not available' 
      };
    }

    const { currentLevel, nextLevel } = aalData;

    // Check if user has enrolled MFA factors
    const { data: factorsData, error: factorsError } = await authClient.auth.mfa.listFactors();
    
    if (factorsError) {
      console.error('Error listing MFA factors:', factorsError);
      return { 
        verified: false, 
        error: 'Failed to check MFA enrollment' 
      };
    }

    const verifiedFactors = factorsData?.totp?.filter((f: any) => f.status === 'verified') || [];
    
    // If no MFA factors enrolled, require enrollment
    if (verifiedFactors.length === 0) {
      console.warn(`Privileged user (${userRole}) has no MFA factors enrolled`);
      return {
        verified: false,
        error: 'MFA enrollment required for privileged roles',
        currentLevel,
        nextLevel,
      };
    }

    // If MFA is enrolled but not verified in current session (AAL1 when AAL2 is required)
    if (currentLevel === 'aal1' && nextLevel === 'aal2') {
      console.warn(`Privileged user (${userRole}) requires MFA verification (current: ${currentLevel}, next: ${nextLevel})`);
      return {
        verified: false,
        error: 'MFA verification required',
        currentLevel,
        nextLevel,
      };
    }

    // User has AAL2 or higher
    if (currentLevel === 'aal2' || currentLevel === 'aal3') {
      return { verified: true, currentLevel, nextLevel };
    }

    // Fallback - if we can't determine AAL but MFA is enrolled, allow with warning
    console.warn(`Could not determine AAL for privileged user (${userRole}), but MFA is enrolled`);
    return { verified: true, currentLevel, nextLevel };

  } catch (err) {
    console.error('MFA verification error:', err);
    return { 
      verified: false, 
      error: 'MFA verification failed' 
    };
  }
}

/**
 * Create a standardized MFA required response
 */
export function createMFARequiredResponse(
  result: MFAVerificationResult,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: result.error || 'MFA verification required',
      code: 'MFA_REQUIRED',
      currentLevel: result.currentLevel,
      nextLevel: result.nextLevel,
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  );
}
