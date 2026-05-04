// deno-lint-ignore-file no-explicit-any
import { getCorsHeaders, createErrorResponse } from "../_shared/security.ts";
import { buildRequestPdf, loadRequestData, createServiceClient } from "../_shared/request-pdf.ts";

Deno.serve(async (req) => {
  const cors = {
    ...getCorsHeaders(req.headers.get("origin")),
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";
    if (!token || token.length < 20 || token.length > 100 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return new Response("Invalid link", { status: 400, headers: cors });
    }

    const service = createServiceClient();
    const { data: link } = await service.from("request_share_links")
      .select("*").eq("token", token).maybeSingle();

    if (!link) return new Response("Link not found", { status: 404, headers: cors });
    if (link.revoked_at) return new Response("Link has been revoked", { status: 410, headers: cors });
    if (new Date(link.expires_at) < new Date()) {
      return new Response("Link has expired", { status: 410, headers: cors });
    }

    const data = await loadRequestData(service, link.request_id);
    const pdfBytes = await buildRequestPdf(data);

    await service.from("request_share_links")
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: (link.access_count || 0) + 1,
      })
      .eq("id", link.id);

    await service.from("request_share_audit").insert({
      request_id: link.request_id,
      actor_id: null,
      action: "link_accessed",
      share_link_id: link.id,
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    const filename = `request-${link.request_id.slice(0, 8)}.pdf`;
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return createErrorResponse(e, "public-pdf", 500, cors);
  }
});
