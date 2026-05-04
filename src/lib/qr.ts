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

export function qrLandingUrl(code: string) {
  return `${window.location.origin}/qr/${code}`;
}

export function makeShortCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}
