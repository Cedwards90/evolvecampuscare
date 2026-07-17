import { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { linkify } from '@/lib/linkify';
import { useToast } from '@/hooks/use-toast';

interface SafeRichTextProps {
  text: string | null | undefined;
  /** Number of lines to clamp to before showing "Show more". 0 = no clamp. */
  clampLines?: number;
  showCopy?: boolean;
  className?: string;
  /** Tone used for the show more/less and copy button text. */
  tone?: 'default' | 'inverse';
}

/**
 * Renders untrusted plain text safely:
 * - Preserves newlines/indentation from paste (whitespace-pre-wrap).
 * - Wraps long unbroken tokens (overflow-wrap: anywhere) so URLs/IDs never
 *   overflow the parent container.
 * - Auto-linkifies URLs, emails, and phone numbers.
 * - Optional clamp with a Show more/less toggle (CSS clamp, full text stays
 *   in the DOM for accessibility and copy).
 * - Optional Copy button that copies the original text (not shortened).
 * - Never uses dangerouslySetInnerHTML; pasted HTML has no effect.
 */
export function SafeRichText({
  text,
  clampLines = 0,
  showCopy = false,
  className,
  tone = 'default',
}: SafeRichTextProps) {
  const value = (text ?? '').toString();
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  const nodes = useMemo(() => linkify(value), [value]);

  const clampEnabled = clampLines > 0;

  useLayoutEffect(() => {
    if (!clampEnabled) return;
    const el = bodyRef.current;
    if (!el) return;
    // Measure once after render; expanded state removes the clamp so we only
    // need to detect overflow while collapsed.
    if (!expanded) {
      setOverflowing(el.scrollHeight - 1 > el.clientHeight);
    }
  }, [value, clampEnabled, expanded, clampLines]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Your browser blocked clipboard access.',
      });
    }
  };

  const controlClass = cn(
    'h-auto px-2 py-1 text-xs',
    tone === 'inverse'
      ? 'text-primary-foreground/90 hover:text-primary-foreground hover:bg-white/10'
      : 'text-muted-foreground hover:text-foreground'
  );

  const clampStyle =
    clampEnabled && !expanded
      ? ({
          display: '-webkit-box',
          WebkitLineClamp: clampLines,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        } as const)
      : undefined;

  if (!value) return null;

  return (
    <div className={cn('min-w-0 max-w-full', className)}>
      <div
        ref={bodyRef}
        style={clampStyle}
        className={cn(
          'whitespace-pre-wrap break-words',
          '[overflow-wrap:anywhere]'
        )}
      >
        {nodes}
      </div>
      {(clampEnabled && overflowing) || showCopy ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {clampEnabled && overflowing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={controlClass}
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? 'Show less' : 'Show more'}
            </Button>
          )}
          {showCopy && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={controlClass}
              onClick={handleCopy}
              aria-label="Copy text"
            >
              {copied ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <Copy className="h-3 w-3 mr-1" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
