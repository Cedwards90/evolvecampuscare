import QRCode from 'qrcode';

export async function generateQRDataURL(text: string, opts?: { size?: number; dark?: string; light?: string }) {
  return QRCode.toDataURL(text, {
    width: opts?.size ?? 512,
    margin: 2,
    color: {
      dark: opts?.dark ?? '#054D3B',
      light: opts?.light ?? '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });
}

// Always point QR codes at the public production domain so scans never land
// on the Lovable preview/editor (which requires a Lovable login).
export const QR_PUBLIC_BASE_URL = 'https://evolvecampuscare.lovable.app';

export function qrLandingUrl(code: string) {
  const base =
    typeof window !== 'undefined' &&
    /^(localhost|127\.|.*\.lovable\.dev$)/.test(window.location.hostname)
      ? QR_PUBLIC_BASE_URL
      : QR_PUBLIC_BASE_URL; // always use production base for shareable QR codes
  return `${base}/qr/${code}`;
}

export function makeShortCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}
