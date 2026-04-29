/**
 * Centralized React Query key factory.
 *
 * Keep keys structurally identical to the strings used historically across hooks
 * so existing cache entries and invalidations keep matching during incremental migration.
 *
 * Usage:
 *   useQuery({ queryKey: queryKeys.students.detail(id), ... })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
 */
export const queryKeys = {
  users: {
    all: ['users-with-roles'] as const,
    caseManagers: ['case-managers'] as const,
    students: ['students'] as const,
  },
  students: {
    all: ['student-detail'] as const,
    detail: (id: string | undefined) => ['student-detail', id] as const,
    assignments: ['student-assignments'] as const,
    unassigned: ['unassigned-students'] as const,
    folders: ['student-folders'] as const,
  },
  caseManagers: {
    stats: (id?: string) => (id ? ['case-manager-stats', id] as const : ['case-manager-stats'] as const),
  },
  requests: {
    all: ['requests'] as const,
    list: (filters?: unknown) => ['requests', filters] as const,
    detail: (id: string) => ['request', id] as const,
  },
  organizations: {
    all: ['training-organizations'] as const,
    active: ['training-organizations', 'active'] as const,
    detail: (id: string) => ['organization-detail', id] as const,
    members: (id: string) => ['organization-members', id] as const,
    name: (id: string) => ['org-name', id] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    range: (days: number) => ['analytics', days] as const,
  },
} as const;
