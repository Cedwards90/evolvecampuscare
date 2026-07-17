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
  name: "whoami",
  title: "Who am I",
  description:
    "Return the signed-in user's id, email, role, and organization for this app.",
  inputSchema: {},
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, email, organization_id, cohort_id")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const summary = {
      user_id: userId,
      email: ctx.getUserEmail() ?? profile?.email ?? null,
      full_name: profile?.full_name ?? null,
      role: roleRow?.role ?? null,
      organization_id: profile?.organization_id ?? null,
      cohort_id: profile?.cohort_id ?? null,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
