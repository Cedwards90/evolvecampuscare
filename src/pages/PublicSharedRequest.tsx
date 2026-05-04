import { useParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function PublicSharedRequest() {
  const { token } = useParams<{ token: string }>();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const pdfUrl = `https://${projectId}.supabase.co/functions/v1/public-request-pdf?token=${encodeURIComponent(token || "")}`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <span className="font-semibold">Evolve Foundation — Confidential Document</span>
        </div>
        <a href={pdfUrl} download className="text-xs underline">Download</a>
      </header>
      <div className="flex-1 bg-muted">
        <object data={pdfUrl} type="application/pdf" className="w-full h-[calc(100vh-48px)]">
          <div className="p-8 text-center">
            <p className="mb-4">Your browser cannot display the PDF inline.</p>
            <a className="underline text-primary" href={pdfUrl}>Download the PDF</a>
          </div>
        </object>
      </div>
    </div>
  );
}
