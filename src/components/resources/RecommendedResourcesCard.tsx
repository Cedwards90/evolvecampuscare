import { Sparkles, X, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResourceCard } from './ResourceCard';
import {
  useResourceRecommendations,
  useDismissRecommendation,
  useMarkRecommendationClicked,
} from '@/hooks/useResourceRecommendations';

interface Props {
  studentId: string;
  title?: string;
  description?: string;
  limit?: number;
  showSeeAll?: boolean;
  loading?: boolean;
  emptyMessage?: string;
}

export function RecommendedResourcesCard({
  studentId,
  title = 'Recommended for you',
  description = 'Community organizations matched to what you shared with us.',
  limit = 5,
  showSeeAll = true,
  loading,
  emptyMessage = 'No recommendations yet. Complete your intake to get matched.',
}: Props) {
  const { data, isLoading } = useResourceRecommendations(studentId);
  const dismiss = useDismissRecommendation();
  const click = useMarkRecommendationClicked();

  const recs = (data || []).slice(0, limit);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {showSeeAll && (
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to="/resources">
              Browse all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {(loading || isLoading) ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Finding the right resources…
          </div>
        ) : recs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{emptyMessage}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recs.map((r) =>
              r.resource ? (
                <ResourceCard
                  key={r.id}
                  resource={r.resource}
                  reason={r.reason}
                  onVisit={() => click.mutate(r.id)}
                  actions={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 -mr-1 -mt-1 shrink-0"
                      onClick={() => dismiss.mutate(r.id)}
                      title="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  }
                />
              ) : null,
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
