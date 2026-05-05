import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarLayout } from "@/components/layouts/SidebarLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { toast } from "sonner";
import { Download, Plus } from "lucide-react";

export default function AdminNda() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [publishOpen, setPublishOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ["admin", "nda", "documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nda_documents")
        .select("*")
        .order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: acceptances, isLoading: accLoading } = useQuery({
    queryKey: ["admin", "nda", "acceptances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nda_acceptances")
        .select("id, user_id, version, accepted_at, ip_address, user_agent")
        .order("accepted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const userIds = Array.from(new Set((data || []).map((a) => a.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
      const map = new Map((profiles || []).map((p) => [p.user_id, p]));
      return (data || []).map((a) => ({
        ...a,
        email: map.get(a.user_id)?.email || "—",
        full_name: map.get(a.user_id)?.full_name || "—",
      }));
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim() || !newBody.trim()) {
        throw new Error("Title and body are required");
      }
      const maxVersion = Math.max(0, ...((documents || []).map((d) => d.version)));
      // Demote current first to satisfy unique constraint
      await supabase
        .from("nda_documents")
        .update({ is_current: false })
        .eq("is_current", true);
      const { error } = await supabase.from("nda_documents").insert({
        version: maxVersion + 1,
        title: newTitle.trim(),
        body_markdown: newBody,
        is_current: true,
        effective_at: new Date().toISOString(),
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("New NDA version published. All users will re-accept on next login.");
      setPublishOpen(false);
      setNewTitle("");
      setNewBody("");
      qc.invalidateQueries({ queryKey: ["admin", "nda"] });
      qc.invalidateQueries({ queryKey: ["nda"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to publish"),
  });

  const exportCsv = () => {
    if (!acceptances?.length) return;
    const headers = ["Email", "Name", "Version", "Accepted At", "IP", "User Agent"];
    const rows = acceptances.map((a) => [
      a.email,
      a.full_name,
      String(a.version),
      a.accepted_at,
      a.ip_address || "",
      (a.user_agent || "").replace(/"/g, "'"),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nda-acceptances-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const current = documents?.find((d) => d.is_current);

  return (
    <SidebarLayout>
      <PageHeader
        title="NDA Management"
        description="Manage the platform's Non-Disclosure Agreement and view acceptance records."
      >
        <Button className="rounded-full" onClick={() => setPublishOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Publish new version
        </Button>
      </PageHeader>

      <Tabs defaultValue="current" className="mt-6">
        <TabsList>
          <TabsTrigger value="current">Current NDA</TabsTrigger>
          <TabsTrigger value="versions">Version history</TabsTrigger>
          <TabsTrigger value="log">Acceptance log</TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          {docsLoading ? (
            <LoadingSpinner />
          ) : current ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  v{current.version} · {current.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Effective {new Date(current.effective_at).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent>
                <article className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{current.body_markdown}</ReactMarkdown>
                </article>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground">No current NDA.</p>
          )}
        </TabsContent>

        <TabsContent value="versions">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(documents || []).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>v{d.version}</TableCell>
                      <TableCell>{d.title}</TableCell>
                      <TableCell>
                        {new Date(d.effective_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {d.is_current ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                            Current
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Archived
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log">
          <div className="mb-3 flex justify-end">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={exportCsv}
              disabled={!acceptances?.length}
            >
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {accLoading ? (
                <div className="p-6">
                  <LoadingSpinner />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Accepted</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Browser</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(acceptances || []).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium">{a.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.email}
                          </div>
                        </TableCell>
                        <TableCell>v{a.version}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(a.accepted_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.ip_address || "—"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[240px] truncate">
                          {a.user_agent || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!acceptances?.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No acceptances yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Publish new NDA version</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nda-title">Title</Label>
              <Input
                id="nda-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Evolve Foundation Platform NDA"
              />
            </div>
            <div>
              <Label htmlFor="nda-body">Body (Markdown)</Label>
              <Textarea
                id="nda-body"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={20}
                className="font-mono text-xs"
                placeholder="# Title&#10;&#10;## 1. Confidential Information..."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Publishing will mark this as the current version and require all
              users — including admins — to re-accept on their next page load.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setPublishOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full"
              onClick={() => publish.mutate()}
              disabled={publish.isPending || !newTitle.trim() || !newBody.trim()}
            >
              {publish.isPending ? "Publishing…" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  );
}
