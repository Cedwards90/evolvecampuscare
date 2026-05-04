import { useState } from "react";
import { Download, Mail, Link2, Copy, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  useDownloadRequestPdf, useEmailRequestPdf,
  useShareLinks, useCreateShareLink, useRevokeShareLink, shareLinkUrl,
} from "@/hooks/useRequestSharing";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requestId: string;
  requestTitle: string;
}

export function SharePdfDialog({ open, onOpenChange, requestId, requestTitle }: Props) {
  const [emailsText, setEmailsText] = useState("");
  const [message, setMessage] = useState("");
  const [expiresHours, setExpiresHours] = useState("24");

  const download = useDownloadRequestPdf();
  const sendEmail = useEmailRequestPdf();
  const links = useShareLinks(open ? requestId : undefined);
  const createLink = useCreateShareLink();
  const revoke = useRevokeShareLink();

  const handleDownload = async () => {
    try { await download.mutateAsync(requestId); toast.success("PDF downloaded"); }
    catch (e: any) { toast.error(e.message || "Download failed"); }
  };

  const handleEmail = async () => {
    const recipients = emailsText.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
    if (!recipients.length) { toast.error("Add at least one email"); return; }
    try {
      const res: any = await sendEmail.mutateAsync({ requestId, recipients, message });
      toast.success(`PDF sent to ${res.sent_to} recipient(s)`);
      setEmailsText(""); setMessage("");
    } catch (e: any) { toast.error(e.message || "Could not send"); }
  };

  const handleCreateLink = async () => {
    try {
      await createLink.mutateAsync({ requestId, expiresInHours: Number(expiresHours) });
      toast.success("Secure link created");
    } catch (e: any) { toast.error(e.message || "Could not create link"); }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Link copied"); }
    catch { toast.error("Copy failed"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Share as PDF
          </DialogTitle>
          <DialogDescription className="line-clamp-1">{requestTitle}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300">
          This PDF contains <strong>confidential</strong> information including internal notes. Share only with authorized parties.
        </div>

        <Tabs defaultValue="download" className="mt-2">
          <TabsList className="grid grid-cols-3 w-full rounded-full">
            <TabsTrigger value="download" className="rounded-full"><Download className="h-4 w-4 mr-1" />Download</TabsTrigger>
            <TabsTrigger value="email" className="rounded-full"><Mail className="h-4 w-4 mr-1" />Email</TabsTrigger>
            <TabsTrigger value="link" className="rounded-full"><Link2 className="h-4 w-4 mr-1" />Secure link</TabsTrigger>
          </TabsList>

          <TabsContent value="download" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Generate a confidential PDF of this request and download it to your device.
            </p>
            <Button onClick={handleDownload} disabled={download.isPending} className="rounded-full">
              {download.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download PDF
            </Button>
          </TabsContent>

          <TabsContent value="email" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="emails">Recipient emails</Label>
              <Input id="emails" placeholder="recipient@example.com, another@example.com"
                value={emailsText} onChange={e => setEmailsText(e.target.value)} />
              <p className="text-xs text-muted-foreground">Up to 10 recipients. Separate with commas or spaces.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg">Message (optional)</Label>
              <Textarea id="msg" rows={3} value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Add a brief message to include in the email." />
            </div>
            <Button onClick={handleEmail} disabled={sendEmail.isPending} className="rounded-full">
              {sendEmail.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Send PDF
            </Button>
          </TabsContent>

          <TabsContent value="link" className="space-y-4 pt-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Expires in</Label>
                <Select value={expiresHours} onValueChange={setExpiresHours}>
                  <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                    <SelectItem value="720">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateLink} disabled={createLink.isPending} className="rounded-full">
                {createLink.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                Create link
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Existing links</Label>
              {links.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : !links.data?.length ? (
                <div className="text-sm text-muted-foreground py-3">No links yet.</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-auto">
                  {links.data.map(l => {
                    const expired = new Date(l.expires_at) < new Date();
                    const status = l.revoked_at ? "revoked" : expired ? "expired" : "active";
                    const url = shareLinkUrl(l.token);
                    return (
                      <div key={l.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <Badge variant={status === "active" ? "default" : "secondary"} className="rounded-full capitalize">
                            {status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {status === "active"
                              ? `Expires ${formatDistanceToNow(new Date(l.expires_at), { addSuffix: true })}`
                              : `Created ${format(new Date(l.created_at), "PP")}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 truncate text-xs bg-muted p-1.5 rounded">{url}</code>
                          {status === "active" && (
                            <>
                              <Button size="icon" variant="outline" className="rounded-full h-8 w-8" onClick={() => copy(url)}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="outline" className="rounded-full h-8 w-8"
                                onClick={() => revoke.mutate({ requestId, linkId: l.id })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Accessed {l.access_count} time{l.access_count === 1 ? "" : "s"}
                          {l.last_accessed_at ? ` · last ${formatDistanceToNow(new Date(l.last_accessed_at), { addSuffix: true })}` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
