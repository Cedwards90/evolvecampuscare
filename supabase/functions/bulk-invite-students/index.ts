import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  getCorsHeaders,
  sanitizeError,
  verifyMFAForPrivilegedRole,
  createMFARequiredResponse,
} from "../_shared/security.ts";

interface InviteEntry {
  email: string;
  fullName?: string;
}

interface RequestBody {
  emails: InviteEntry[];
  notes?: string;
  organizationId?: string;
}

const MAX_BATCH = 100;

async function processJob(opts: {
  supabase: any;
  jobId: string;
  emails: InviteEntry[];
  notes?: string;
  organizationId?: string;
  authHeader: string;
}) {
  const { supabase, jobId, emails, notes, organizationId, authHeader } = opts;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const entry of emails) {
    const { data: itemRow } = await supabase
      .from("bulk_invite_job_items")
      .insert({
        job_id: jobId,
        email: entry.email,
        full_name: entry.fullName ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    try {
      // Check if invitation already exists (pending)
      const { data: existing } = await supabase
        .from("user_invitations")
        .select("id")
        .eq("email", entry.email)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (existing) {
        skipped++;
        await supabase
          .from("bulk_invite_job_items")
          .update({ status: "skipped", error: "Already invited" })
          .eq("id", itemRow!.id);
        continue;
      }

      // Generate token
      const tokenRes = await supabase.functions.invoke("generate-invitation-token", {
        body: {
          email: entry.email,
          role: "student",
          notes,
          organizationId,
        },
        headers: { Authorization: authHeader },
      });

      if (tokenRes.error || tokenRes.data?.error) {
        throw new Error(tokenRes.error?.message || tokenRes.data?.error || "Token generation failed");
      }

      const { invitation, token } = tokenRes.data;

      // Send invitation email
      const emailRes = await supabase.functions.invoke("send-user-invitation", {
        body: {
          email: entry.email,
          role: "student",
          token,
          inviterName: "Evolve Foundation",
          notes,
        },
        headers: { Authorization: authHeader },
      });

      if (emailRes.error || emailRes.data?.error) {
        // Invitation row exists but email failed - still mark as failed
        failed++;
        await supabase
          .from("bulk_invite_job_items")
          .update({
            status: "failed",
            error: emailRes.data?.error || emailRes.error?.message || "Email send failed",
            invitation_id: invitation?.id,
          })
          .eq("id", itemRow!.id);
        continue;
      }

      succeeded++;
      await supabase
        .from("bulk_invite_job_items")
        .update({ status: "sent", invitation_id: invitation?.id })
        .eq("id", itemRow!.id);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message.slice(0, 250) : "Unknown error";
      await supabase
        .from("bulk_invite_job_items")
        .update({ status: "failed", error: msg })
        .eq("id", itemRow!.id);
    }

    // Update progress
    await supabase
      .from("bulk_invite_jobs")
      .update({
        processed: succeeded + failed + skipped,
        succeeded,
        failed,
        skipped,
      })
      .eq("id", jobId);
  }

  await supabase
    .from("bulk_invite_jobs")
    .update({
      status: "complete",
      processed: emails.length,
      succeeded,
      failed,
      skipped,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  return { succeeded, failed, skipped };
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden — admins only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mfaResult = await verifyMFAForPrivilegedRole(authClient, roleData.role);
    if (!mfaResult.verified) {
      return createMFARequiredResponse(mfaResult, corsHeaders);
    }

    const body = (await req.json()) as RequestBody;
    if (!body || !Array.isArray(body.emails) || body.emails.length === 0) {
      return new Response(JSON.stringify({ error: "No emails provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.emails.length > MAX_BATCH) {
      return new Response(
        JSON.stringify({ error: `Max ${MAX_BATCH} emails per batch` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleaned: InviteEntry[] = [];
    const seen = new Set<string>();
    for (const e of body.emails) {
      const email = (e.email || "").trim().toLowerCase();
      if (!emailRegex.test(email)) continue;
      if (seen.has(email)) continue;
      seen.add(email);
      cleaned.push({ email, fullName: e.fullName?.trim() || undefined });
    }

    if (cleaned.length === 0) {
      return new Response(JSON.stringify({ error: "No valid emails after validation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create job
    const { data: job, error: jobErr } = await supabase
      .from("bulk_invite_jobs")
      .insert({
        created_by: user.id,
        total: cleaned.length,
        notes: body.notes ?? null,
        organization_id: body.organizationId ?? null,
        status: "processing",
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      throw new Error(jobErr?.message || "Failed to create job");
    }

    const runProcess = () =>
      processJob({
        supabase,
        jobId: job.id,
        emails: cleaned,
        notes: body.notes,
        organizationId: body.organizationId,
        authHeader,
      }).catch(async (err) => {
        console.error("Job processing failed:", err);
        await supabase
          .from("bulk_invite_jobs")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", job.id);
      });

    // Background for larger batches
    if (cleaned.length > 20) {
      // @ts-ignore EdgeRuntime is available in Deno Deploy
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(runProcess());
      } else {
        runProcess();
      }
      return new Response(
        JSON.stringify({ jobId: job.id, total: cleaned.length, async: true }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else {
      const result = await runProcess();
      return new Response(
        JSON.stringify({ jobId: job.id, total: cleaned.length, async: false, ...result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error) {
    const safeMessage = sanitizeError(error, "bulk-invite-students");
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
