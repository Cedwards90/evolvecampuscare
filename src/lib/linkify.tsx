import { Fragment, type ReactNode } from 'react';

// Combined pattern: URLs first, then emails, then phones (10+ digits).
// URL: http(s)://... or www.host...
// Email: local@host.tld
// Phone: optional +1, then (NNN) NNN-NNNN with common separators.
const TOKEN_RE = new RegExp(
  [
    // URL with protocol
    "(https?:\\/\\/[^\\s<>()\\[\\]{}'\"]+)",
    // bare www.
    "(www\\.[^\\s<>()\\[\\]{}'\"]+)",
    // email
    '([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,})',
    // phone
    '(\\+?1[\\s.-]?)?\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}',
  ].join('|'),
  'g'
);

const TRAILING_PUNCT = /[),.!?;:'"]+$/;

function shortenUrl(raw: string, max = 42): string {
  try {
    const withProto = raw.startsWith('http') ? raw : `https://${raw}`;
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname === '/' ? '' : u.pathname;
    const display = host + path + (u.search ? '?…' : '');
    if (display.length <= max) return display;
    return display.slice(0, max - 1) + '…';
  } catch {
    return raw.length <= max ? raw : raw.slice(0, max - 1) + '…';
  }
}

function digitsOnly(s: string) {
  return s.replace(/\D+/g, '');
}

function renderLink(kind: 'url' | 'email' | 'phone', value: string, key: number): ReactNode {
  const linkClass =
    'underline underline-offset-2 break-all hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring rounded-sm';

  if (kind === 'url') {
    const href = value.startsWith('http') ? value : `https://${value}`;
    return (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        title={value}
        className={linkClass}
      >
        {shortenUrl(value)}
      </a>
    );
  }
  if (kind === 'email') {
    return (
      <a key={key} href={`mailto:${value}`} className={linkClass} title={value}>
        {value}
      </a>
    );
  }
  return (
    <a key={key} href={`tel:${digitsOnly(value)}`} className={linkClass} title={value}>
      {value}
    </a>
  );
}

/**
 * Split a plain-text string into a mix of text and anchor React nodes.
 * Never interprets HTML; input is treated as literal text.
 */
export function linkify(text: string): ReactNode[] {
  if (!text) return [];
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;
  // Reset regex state (global regex is stateful).
  TOKEN_RE.lastIndex = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const idx = match.index ?? 0;
    let raw = match[0];

    // Strip trailing punctuation like ")." or "," from a URL/email match
    // and push it back into the following text stream.
    let trailing = '';
    const trailingMatch = raw.match(TRAILING_PUNCT);
    if (trailingMatch) {
      trailing = trailingMatch[0];
      raw = raw.slice(0, raw.length - trailing.length);
    }
    if (!raw) continue;

    if (idx > lastIndex) {
      nodes.push(text.slice(lastIndex, idx));
    }

    let kind: 'url' | 'email' | 'phone' = 'url';
    if (match[1] || match[2]) kind = 'url';
    else if (match[3]) kind = 'email';
    else kind = 'phone';

    // Phone guard: require >=10 digits to avoid matching IDs like "12345 67890".
    if (kind === 'phone' && digitsOnly(raw).length < 10) {
      nodes.push(raw + trailing);
    } else {
      nodes.push(renderLink(kind, raw, keyCounter++));
      if (trailing) nodes.push(trailing);
    }

    lastIndex = idx + raw.length + trailing.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.map((n, i) =>
    typeof n === 'string' ? <Fragment key={`t-${i}`}>{n}</Fragment> : n
  );
}
