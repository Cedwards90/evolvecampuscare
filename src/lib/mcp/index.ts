import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listSupportRequestsTool from "./tools/list_support_requests";

// Direct Supabase issuer (never the .lovable.cloud proxy). Built from the
// project ref which Vite inlines at build time — keeps this module import-safe.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "evolve-campus-care-mcp",
  title: "Evolve Campus Care",
  version: "0.1.0",
  instructions:
    "Tools for the Evolve Campus Care platform. Callers act as the signed-in user; all reads and writes respect the app's roles and row-level security. Use `whoami` to confirm identity and `list_support_requests` to view requests visible to the current user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listSupportRequestsTool],
});
