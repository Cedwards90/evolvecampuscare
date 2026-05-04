// deno-lint-ignore-file no-explicit-any
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const FOREST = rgb(0.020, 0.302, 0.231); // #054D3B
const SAGE = rgb(0.533, 0.663, 0.549);   // #88A98C
const GREY = rgb(0.4, 0.4, 0.4);
const DARK = rgb(0.1, 0.1, 0.1);

export async function loadRequestData(serviceClient: any, requestId: string) {
  const { data: request, error } = await serviceClient
    .from("support_requests").select("*").eq("id", requestId).maybeSingle();
  if (error || !request) throw new Error("Request not found");

  const [studentRes, cmRes, updatesRes, attachmentsRes, orgRes] = await Promise.all([
    serviceClient.from("profiles")
      .select("user_id, full_name, email, phone, student_id, organization_id")
      .eq("user_id", request.student_id).maybeSingle(),
    request.assigned_case_manager_id
      ? serviceClient.from("profiles")
          .select("user_id, full_name, email").eq("user_id", request.assigned_case_manager_id).maybeSingle()
      : Promise.resolve({ data: null }),
    serviceClient.from("request_updates")
      .select("id, note, new_status, previous_status, is_internal, created_at, user_id")
      .eq("request_id", requestId).order("created_at", { ascending: true }),
    serviceClient.from("request_attachments")
      .select("file_name, file_size, mime_type, created_at").eq("request_id", requestId),
    Promise.resolve(null),
  ]);

  let organization = null;
  const orgId = (studentRes.data as any)?.organization_id;
  if (orgId) {
    const { data } = await serviceClient
      .from("training_organizations").select("name").eq("id", orgId).maybeSingle();
    organization = data;
  }

  // resolve update authors
  const userIds = Array.from(new Set(((updatesRes.data as any[]) || []).map(u => u.user_id).filter(Boolean)));
  let authorMap: Record<string, string> = {};
  if (userIds.length) {
    const { data } = await serviceClient.from("profiles")
      .select("user_id, full_name, email").in("user_id", userIds);
    (data || []).forEach((p: any) => { authorMap[p.user_id] = p.full_name || p.email || ""; });
  }

  return {
    request,
    student: studentRes.data,
    caseManager: cmRes.data,
    organization,
    updates: (updatesRes.data || []).map((u: any) => ({ ...u, author: authorMap[u.user_id] || "Unknown" })),
    attachments: attachmentsRes.data || [],
  };
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return String(d); }
}

export async function buildRequestPdf(data: Awaited<ReturnType<typeof loadRequestData>>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Support Request — ${data.request.title}`);
  pdf.setProducer("Evolve Foundation Campus Care");
  pdf.setCreator("Evolve Foundation");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 50;
  const MAX_W = PAGE_W - MARGIN * 2;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    drawHeader();
  };

  const ensure = (needed: number) => { if (y - needed < MARGIN + 30) newPage(); };

  const wrap = (text: string, f = font, size = 10): string[] => {
    if (!text) return [""];
    const lines: string[] = [];
    for (const para of String(text).split(/\n/)) {
      const words = para.split(/\s+/);
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (f.widthOfTextAtSize(test, size) > MAX_W) {
          if (cur) lines.push(cur);
          cur = w;
        } else cur = test;
      }
      lines.push(cur);
    }
    return lines;
  };

  const text = (s: string, opts: { font?: any; size?: number; color?: any; indent?: number } = {}) => {
    const f = opts.font || font;
    const size = opts.size || 10;
    const color = opts.color || DARK;
    const lines = wrap(s, f, size);
    for (const line of lines) {
      ensure(size + 4);
      page.drawText(line, { x: MARGIN + (opts.indent || 0), y, size, font: f, color });
      y -= size + 4;
    }
  };

  const heading = (s: string) => {
    ensure(28);
    y -= 6;
    page.drawText(s, { x: MARGIN, y, size: 13, font: bold, color: FOREST });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
      thickness: 1, color: SAGE,
    });
    y -= 12;
  };

  const kv = (k: string, v: string) => {
    ensure(16);
    page.drawText(k, { x: MARGIN, y, size: 9, font: bold, color: GREY });
    const lines = wrap(v || "—", font, 10);
    page.drawText(lines[0], { x: MARGIN + 140, y, size: 10, font, color: DARK });
    y -= 14;
    for (let i = 1; i < lines.length; i++) {
      ensure(14);
      page.drawText(lines[i], { x: MARGIN + 140, y, size: 10, font, color: DARK });
      y -= 14;
    }
  };

  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: PAGE_H - 36, width: PAGE_W, height: 36, color: FOREST });
    page.drawText("Evolve Foundation — Campus Care", {
      x: MARGIN, y: PAGE_H - 23, size: 12, font: bold, color: rgb(1, 1, 1),
    });
    page.drawText("CONFIDENTIAL", {
      x: PAGE_W - MARGIN - 70, y: PAGE_H - 23, size: 9, font: bold, color: rgb(1, 1, 1),
    });
    y = PAGE_H - 50;
  };

  drawHeader();

  // Title
  ensure(40);
  text(data.request.title, { font: bold, size: 18, color: FOREST });
  y -= 4;
  text(`Generated ${new Date().toLocaleString("en-US")}`, { size: 8, color: GREY });
  y -= 6;

  // Summary
  heading("Request Summary");
  kv("Status", String(data.request.status).replace(/_/g, " ").toUpperCase());
  kv("Priority", String(data.request.priority).toUpperCase());
  kv("Category", String(data.request.category).replace(/_/g, " "));
  if (data.request.is_emergency) kv("Emergency", "Yes");
  kv("Created", fmtDate(data.request.created_at));
  kv("Last updated", fmtDate(data.request.updated_at));
  if (data.request.escalated_at) kv("Escalated", fmtDate(data.request.escalated_at));
  if (data.request.resolved_at) kv("Resolved", fmtDate(data.request.resolved_at));

  // Student
  heading("Student");
  const s: any = data.student || {};
  kv("Name", s.full_name || "—");
  kv("Email", s.email || "—");
  if (s.phone) kv("Phone", s.phone);
  if (s.student_id) kv("Student ID", s.student_id);
  if (data.organization) kv("Organization", (data.organization as any).name);

  // Assigned staff
  heading("Assigned Case Manager");
  if (data.caseManager) {
    const cm: any = data.caseManager;
    kv("Name", cm.full_name || "—");
    kv("Email", cm.email || "—");
  } else {
    text("Unassigned", { color: GREY });
  }

  // Description
  heading("Description");
  text(data.request.description || "—");

  // Monetary
  if (data.request.category === "financial" && (data.request.requested_amount || data.request.approved_amount != null)) {
    heading("Monetary Details");
    if (data.request.requested_amount != null) kv("Requested", `$${Number(data.request.requested_amount).toFixed(2)}`);
    if (data.request.approved_amount != null) kv("Approved", `$${Number(data.request.approved_amount).toFixed(2)}`);
  }

  // Timeline
  heading(`Timeline & Notes (${data.updates.length})`);
  if (!data.updates.length) {
    text("No timeline entries yet.", { color: GREY });
  } else {
    for (const u of data.updates) {
      ensure(40);
      const stamp = fmtDate(u.created_at);
      const tag = u.is_internal ? " [INTERNAL]" : "";
      page.drawText(`${stamp}${tag}`, { x: MARGIN, y, size: 9, font: bold, color: u.is_internal ? rgb(0.7, 0.4, 0) : FOREST });
      y -= 12;
      page.drawText(`by ${u.author}`, { x: MARGIN, y, size: 8, font, color: GREY });
      y -= 12;
      if (u.previous_status && u.new_status) {
        text(`Status: ${u.previous_status} → ${u.new_status}`, { size: 9, color: GREY, indent: 8 });
      }
      if (u.note) text(u.note, { size: 10, indent: 8 });
      y -= 4;
    }
  }

  // Attachments
  heading(`Attachments (${data.attachments.length})`);
  if (!data.attachments.length) {
    text("No attachments.", { color: GREY });
  } else {
    for (const a of data.attachments as any[]) {
      const size = a.file_size ? ` (${(a.file_size / 1024).toFixed(1)} KB)` : "";
      text(`• ${a.file_name}${size}`, { size: 10 });
    }
  }

  // Footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Confidential — Page ${i + 1} of ${pages.length}`, {
      x: MARGIN, y: 24, size: 8, font, color: GREY,
    });
    p.drawText(`Request ID: ${data.request.id}`, {
      x: PAGE_W - MARGIN - 200, y: 24, size: 8, font, color: GREY,
    });
  });

  return await pdf.save();
}

export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
