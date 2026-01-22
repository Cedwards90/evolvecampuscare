// Shared security utilities for edge functions

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
