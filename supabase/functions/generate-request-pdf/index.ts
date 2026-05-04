// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, createErrorResponse } from "../_shared/security.ts";
import { buildRequestPdf, loadRequestData, createServiceClient } from "../_shared/request-pdf.ts";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return createErrorResponse(new Error("permission denied"), "generate-pdf", 401, cors);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return createErrorResponse(new Error("denied"), "generate-pdf", 401, cors);

    const url = new URL(req.url);
    const requestId = url.searchParams.get("request_id");
    if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
      return createErrorResponse(new Error("invalid"), "generate-pdf", 400, cors);
    }

    const service = createServiceClient();
    const { data: canAccess } = await service.rpc("can_staff_access_request", {
      _user: userData.user.id, _request_id: requestId,
    });
    if (!canAccess) return createErrorResponse(new Error("denied"), "generate-pdf", 403, cors);

    const data = await loadRequestData(service, requestId);
    const pdfBytes = await buildRequestPdf(data);

    await service.from("request_share_audit").insert({
      request_id: requestId,
      actor_id: userData.user.id,
      action: "download",
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    const filename = `request-${requestId.slice(0, 8)}.pdf`;
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return createErrorResponse(e, "generate-pdf", 500, cors);
  }
});
