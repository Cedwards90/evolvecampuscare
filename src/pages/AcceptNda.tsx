import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentNda, useAcceptNda } from "@/hooks/useNda";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { logFunnelEvent } from "@/lib/funnelEvents";

export default function AcceptNda() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user, profile } = useAuth();
  const { data: nda, isLoading } = useCurrentNda();
  const accept = useAcceptNda();

  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const redirect =
    new URLSearchParams(location.search).get("redirect") || "/dashboard";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
        setScrolledToBottom(true);
      }
    };
    el.addEventListener("scroll", onScroll);
    // If content fits without scrolling
    if (el.scrollHeight <= el.clientHeight + 8) setScrolledToBottom(true);
    return () => el.removeEventListener("scroll", onScroll);
  }, [nda]);

  const handleAccept = async () => {
    if (!nda) return;
    try {
      await accept.mutateAsync(nda.id);
      logFunnelEvent({
        eventType: 'nda_accepted',
        userId: user?.id ?? null,
        organizationId: profile?.organization_id ?? null,
        metadata: { nda_version: nda.version },
      });
      toast.success("Agreement accepted");
      await Promise.resolve();
      navigate(redirect, { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Could not record acceptance");
    }
  };

  const handleDecline = async () => {
    await signOut();
    toast.info("You must accept the NDA to use this platform.");
    navigate("/auth", { replace: true });
  };

  if (isLoading || !nda) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{nda.title}</h1>
            <p className="text-sm text-muted-foreground">
              Version {nda.version} · Effective{" "}
              {new Date(nda.effective_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="h-[60vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-sm"
        >
          <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-lg prose-h2:mt-6 prose-p:leading-relaxed">
            <ReactMarkdown>{nda.body_markdown}</ReactMarkdown>
          </article>
        </div>

        {!scrolledToBottom && (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Please scroll to the bottom to continue.
          </p>
        )}

        <div className="mt-6 flex items-start gap-3 rounded-2xl border bg-card p-4">
          <Checkbox
            id="agree"
            checked={agreed}
            disabled={!scrolledToBottom}
            onCheckedChange={(c) => setAgreed(c === true)}
            className="mt-1"
          />
          <label
            htmlFor="agree"
            className="text-sm leading-relaxed cursor-pointer"
          >
            I have read, understood, and agree to be legally bound by this
            Non-Disclosure & Non-Use Agreement. I understand that this is a
            binding legal agreement.
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={handleDecline}
            disabled={accept.isPending}
          >
            Decline & Sign Out
          </Button>
          <Button
            className="rounded-full"
            onClick={handleAccept}
            disabled={!agreed || !scrolledToBottom || accept.isPending}
          >
            {accept.isPending ? "Recording…" : "I Accept"}
          </Button>
        </div>
      </div>
    </div>
  );
}
