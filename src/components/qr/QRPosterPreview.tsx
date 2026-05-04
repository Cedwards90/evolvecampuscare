import { useEffect, useState } from 'react';
import { generateQRDataURL, qrLandingUrl } from '@/lib/qr';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface Props {
  code: string;
  label: string;
  organizationName?: string | null;
}

export function QRPosterPreview({ code, label, organizationName }: Props) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const url = qrLandingUrl(code);

  useEffect(() => {
    generateQRDataURL(url, { size: 800 }).then(setDataUrl);
  }, [url]);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) return;
    win.document.write(`
      <html><head><title>${label} — QR Poster</title>
      <style>
        body{font-family:'Inter',sans-serif;color:#054D3B;text-align:center;padding:48px;margin:0}
        img{width:380px;height:380px}
        h1{font-size:36px;margin:24px 0 8px}
        h2{font-size:20px;font-weight:500;color:#666;margin:0 0 32px}
        .url{font-family:monospace;color:#888;margin-top:24px;font-size:14px}
        .steps{margin-top:32px;text-align:left;max-width:480px;margin-left:auto;margin-right:auto}
        .step{display:flex;gap:16px;margin-bottom:12px;align-items:start}
        .num{width:32px;height:32px;border-radius:50%;background:#054D3B;color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;flex-shrink:0}
      </style></head><body>
        <img src="${dataUrl}" alt="QR Code" />
        <h1>Need Support?</h1>
        <h2>${organizationName || label}</h2>
        <div class="steps">
          <div class="step"><div class="num">1</div><div>Open your phone camera and point it at this code</div></div>
          <div class="step"><div class="num">2</div><div>Sign in (or skip if remembered)</div></div>
          <div class="step"><div class="num">3</div><div>Submit a request or schedule a meeting</div></div>
        </div>
        <div class="url">${url}</div>
        <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
      </body></html>
    `);
    win.document.close();
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${code}.png`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6 text-center space-y-3">
        {dataUrl ? (
          <img src={dataUrl} alt="QR preview" className="mx-auto h-56 w-56" />
        ) : (
          <div className="mx-auto h-56 w-56 animate-pulse rounded-lg bg-muted" />
        )}
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground break-all">{url}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-full" onClick={handleDownload}>Download PNG</Button>
        <Button className="flex-1 rounded-full" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" /> Print Poster
        </Button>
      </div>
    </div>
  );
}
