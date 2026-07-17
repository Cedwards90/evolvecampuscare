import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

// Beta helpers on the Supabase JS client — typed locally so this file compiles
// without depending on the SDK exposing `auth.oauth` in its public types.
type OAuthClient = {
  name?: string;
  client_name?: string;
  redirect_uri?: string;
  redirect_uris?: string[];
};
type OAuthDetails = {
  client?: OAuthClient;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { redirect_url?: string; redirect_to?: string };
type SupabaseOAuth = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: SupabaseOAuth }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id in the request.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?redirect=" + encodeURIComponent(next);
        return;
      }
      if (active) setUserEmail(sess.session.user.email ?? null);

      const { data, error: dErr } =
        await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (dErr) {
        setError(dErr.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: dErr } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (dErr) {
      setBusy(false);
      setError(dErr.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect URL returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName =
    details?.client?.name ?? details?.client?.client_name ?? "an application";
  const redirectUri =
    details?.client?.redirect_uri ?? details?.client?.redirect_uris?.[0];

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-medium">Authorize access</span>
          </div>
          <CardTitle className="mt-2 break-words">
            Connect {clientName} to Evolve Campus Care
          </CardTitle>
          <CardDescription>
            {clientName} will be able to call this app's enabled tools while
            you are signed in. This does not bypass this app's permissions or
            row-level security policies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!details && !error && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading
              authorization details…
            </div>
          )}

          {details && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-muted-foreground">Signed in as</div>
                <div className="font-medium break-all">
                  {userEmail ?? "your account"}
                </div>
              </div>
              {redirectUri && (
                <div>
                  <div className="text-muted-foreground">Redirect URI</div>
                  <div className="font-mono text-xs break-all">
                    {redirectUri}
                  </div>
                </div>
              )}
              <div>
                <div className="text-muted-foreground">You are granting</div>
                <ul className="mt-1 list-disc pl-5">
                  <li>Access to your basic profile and email</li>
                  <li>
                    Ability to call this app's tools as you (your role and RLS
                    still apply)
                  </li>
                  {details.scope && !/^(openid|email|profile|\s)+$/i.test(
                    details.scope,
                  ) ? (
                    <li>
                      Additional permission requested:{" "}
                      <span className="font-mono">{details.scope}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button
            variant="ghost"
            disabled={busy || !details}
            onClick={() => decide(false)}
          >
            Cancel connection
          </Button>
          <Button disabled={busy || !details} onClick={() => decide(true)}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working…
              </>
            ) : (
              "Approve"
            )}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
