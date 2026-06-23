import { ExternalLink, Phone, MapPin, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CommunityResource } from '@/hooks/useCommunityResources';

interface ResourceCardProps {
  resource: CommunityResource;
  reason?: string | null;
  onVisit?: () => void;
  compact?: boolean;
  actions?: React.ReactNode;
}

function isUrl(s?: string | null) {
  return !!s && /^https?:\/\//i.test(s);
}
function isEmail(s?: string | null) {
  return !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function ResourceCard({ resource, reason, onVisit, compact, actions }: ResourceCardProps) {
  const contactHref = isUrl(resource.contact)
    ? resource.contact!
    : isEmail(resource.contact)
    ? `mailto:${resource.contact}`
    : null;

  return (
    <Card className="border-border/60">
      <CardContent className={compact ? 'p-4 space-y-2' : 'p-5 space-y-3'}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h4 className="font-semibold text-sm leading-tight truncate">{resource.name}</h4>
            <Badge variant="secondary" className="rounded-full text-[10px] font-normal">
              {resource.category}
            </Badge>
          </div>
          {actions}
        </div>

        {reason && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2">
            {reason}
          </p>
        )}

        <div className="space-y-1 text-xs text-muted-foreground">
          {resource.address && (
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="break-words">{resource.address}</span>
            </div>
          )}
          {resource.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3 shrink-0" />
              <a href={`tel:${resource.phone.replace(/[^\d+]/g, '')}`} className="hover:text-foreground">
                {resource.phone}
              </a>
            </div>
          )}
          {contactHref && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 shrink-0" />
              <a
                href={contactHref}
                target={isUrl(resource.contact) ? '_blank' : undefined}
                rel="noreferrer"
                className="hover:text-foreground truncate"
              >
                {resource.contact}
              </a>
            </div>
          )}
        </div>

        {resource.website && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full w-full"
            asChild
            onClick={onVisit}
          >
            <a href={resource.website} target="_blank" rel="noreferrer">
              Visit website <ExternalLink className="ml-1.5 h-3 w-3" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
