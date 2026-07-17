import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_support_requests",
  title: "List support requests",
  description:
    "List support requests visible to the signed-in user, honoring the app's permissions (students see their own; staff see what their role and assignments allow). Optionally filter by status.",
  inputSchema: {
    status: z
      .enum(["submitted", "in_progress", "resolved", "escalated"])
      .optional()
      .describe("Filter by request status."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max rows to return (default 20)."),
  },
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("support_requests")
      .select(
        "id, title, category, priority, status, requested_amount, approved_amount, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      return {
        content: [{ type: "text", text: `Query failed: ${error.message}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text:
            data && data.length
              ? JSON.stringify(data, null, 2)
              : "No support requests visible to you.",
        },
      ],
      structuredContent: { requests: data ?? [] },
    };
  },
});
