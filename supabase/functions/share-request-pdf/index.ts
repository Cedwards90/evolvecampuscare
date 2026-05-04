// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, createErrorResponse } from "../_shared/security.ts";
import { buildRequestPdf, loadRequestData, createServiceClient } from "../_shared/request-pdf.ts";

const APP_URL = "https://evolvecampuscare.lovable.app";

function genToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return createErrorResponse(new Error("invalid"), "share-pdf", 405, cors);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return createErrorResponse(new Error("denied"), "share-pdf", 401, cors);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return createErrorResponse(new Error("denied"), "share-pdf", 401, cors);
    const actorId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const requestId = body.request_id;
    const mode = body.mode;
    if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
      return createErrorResponse(new Error("invalid"), "share-pdf", 400, cors);
    }
    if (!["email", "create_link", "revoke_link"].includes(mode)) {
      return createErrorResponse(new Error("invalid"), "share-pdf", 400, cors);
    }

    const service = createServiceClient();
    const { data: canAccess } = await service.rpc("can_staff_access_request", {
      _user: actorId, _request_id: requestId,
    });
    if (!canAccess) return createErrorResponse(new Error("denied"), "share-pdf", 403, cors);

    const ip = req.headers.get("x-forwarded-for") || null;
    const ua = req.headers.get("user-agent") || null;

    if (mode === "create_link") {
      const hours = Math.min(Math.max(Number(body.expires_in_hours) || 24, 1), 24 * 30);
      const token = genToken();
      const expires_at = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      const { data: link, error } = await service.from("request_share_links").insert({
        request_id: requestId,
        token,
        created_by: actorId,
        expires_at,
      }).select().single();
      if (error) throw error;

      await service.from("request_share_audit").insert({
        request_id: requestId, actor_id: actorId, action: "link_created",
        share_link_id: link.id, ip, user_agent: ua,
      });

      return new Response(JSON.stringify({
        link: { ...link, url: `${APP_URL}/shared/request/${token}` },
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (mode === "revoke_link") {
      const linkId = body.link_id;
      if (!linkId || !/^[0-9a-f-]{36}$/i.test(linkId)) {
        return createErrorResponse(new Error("invalid"), "share-pdf", 400, cors);
      }
      const { data: link } = await service.from("request_share_links")
        .select("id, request_id").eq("id", linkId).maybeSingle();
      if (!link || link.request_id !== requestId) {
        return createErrorResponse(new Error("not found"), "share-pdf", 404, cors);
      }
      await service.from("request_share_links")
        .update({ revoked_at: new Date().toISOString() }).eq("id", linkId);
      await service.from("request_share_audit").insert({
        request_id: requestId, actor_id: actorId, action: "link_revoked",
        share_link_id: linkId, ip, user_agent: ua,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // EMAIL
    const recipients: string[] = Array.isArray(body.recipients) ? body.recipients : [];
    const cleanRecipients = Array.from(new Set(recipients.map((r: any) => String(r || "").trim().toLowerCase())))
      .filter(isEmail).slice(0, 10);
    if (!cleanRecipients.length) {
      return createErrorResponse(new Error("invalid"), "share-pdf", 400, cors);
    }
    const message = String(body.message || "").slice(0, 2000);

    const data = await loadRequestData(service, requestId);
    const pdfBytes = await buildRequestPdf(data);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const subject = `Support Request: ${data.request.title}`;
    const safeMsg = message.replace(/[<>]/g, "");
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
        <div style="background:#054D3B;color:#fff;padding:18px 24px;">
          <strong>Evolve Foundation — Campus Care</strong>
        </div>
        <div style="padding:24px;">
          <p>A confidential support request file has been shared with you.</p>
          <p><strong>Request:</strong> ${String(data.request.title).replace(/[<>]/g, "")}</p>
          ${safeMsg ? `<p><strong>Message:</strong><br>${safeMsg.replace(/\n/g, "<br>")}</p>` : ""}
          <p style="color:#666;font-size:12px;margin-top:24px;">
            The attached PDF contains confidential information. Please handle it appropriately and do not forward without authorization.
          </p>
        </div>
      </div>`;

    await resend.emails.send({
      from: "Evolve Foundation <noreply@evolvefoundation.us>",
      to: cleanRecipients,
      subject,
      html,
      attachments: [{ filename: `request-${requestId.slice(0, 8)}.pdf`, content: pdfBase64 }],
    });

    await service.from("request_share_audit").insert({
      request_id: requestId, actor_id: actorId, action: "email",
      recipients: cleanRecipients, ip, user_agent: ua,
    });

    return new Response(JSON.stringify({ ok: true, sent_to: cleanRecipients.length }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return createErrorResponse(e, "share-pdf", 500, cors);
  }
});
