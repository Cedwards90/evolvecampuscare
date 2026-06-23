import { useState } from 'react';
import { Search } from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCommunityResources } from '@/hooks/useCommunityResources';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { RESOURCE_CATEGORIES } from '@/lib/resourceMatching';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function Resources() {
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useCommunityResources({
    category: category === 'all' ? undefined : category,
    search,
  });

  return (
    <SidebarLayout>
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader
          title="Community Resources"
          description="Curated Chicago-area organizations offering food, housing, health, legal, employment, and more."
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-full"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-72 rounded-full">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {RESOURCE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No resources found" description="Try a different search or category." />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{data.length} resources</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((r) => (
                <ResourceCard key={r.id} resource={r} />
              ))}
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
