import { Search, Columns3, Download, Building2, GraduationCap, UserCheck, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CRM_COLUMNS } from './crmColumns';

export interface CrmToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  orgFilter: string;
  onOrgFilterChange: (v: string) => void;
  organizations: { id: string; name: string }[];
  cohortFilter: string;
  onCohortFilterChange: (v: string) => void;
  cohorts: { id: string; name: string }[];
  cmFilter: string;
  onCmFilterChange: (v: string) => void;
  caseManagers: { value: string; label: string }[];
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (v: 'all' | 'active' | 'inactive') => void;
  visibleColumns: string[];
  onToggleColumn: (key: string) => void;
  canSeeSensitive: boolean;
  onExport: () => void;
}

export function StudentCrmToolbar({
  search,
  onSearchChange,
  orgFilter,
  onOrgFilterChange,
  organizations,
  cohortFilter,
  onCohortFilterChange,
  cohorts,
  cmFilter,
  onCmFilterChange,
  caseManagers,
  statusFilter,
  onStatusFilterChange,
  visibleColumns,
  onToggleColumn,
  canSeeSensitive,
  onExport,
}: CrmToolbarProps) {
  const columns = CRM_COLUMNS.filter((c) => canSeeSensitive || !c.sensitive);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone or student ID..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {organizations.length > 0 && (
            <Select value={orgFilter} onValueChange={onOrgFilterChange}>
              <SelectTrigger className="w-full sm:w-44">
                <Building2 className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="Organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {cohorts.length > 0 && (
            <Select value={cohortFilter} onValueChange={onCohortFilterChange}>
              <SelectTrigger className="w-full sm:w-40">
                <GraduationCap className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                <SelectItem value="none">No class</SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {caseManagers.length > 0 && (
            <Select value={cmFilter} onValueChange={onCmFilterChange}>
              <SelectTrigger className="w-full sm:w-48">
                <UserCheck className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="Case manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All case managers</SelectItem>
                <SelectItem value="none">Unassigned</SelectItem>
                {caseManagers.map((cm) => (
                  <SelectItem key={cm.value} value={cm.value}>{cm.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as 'all' | 'active' | 'inactive')}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2 shrink-0" />
              <SelectValue placeholder="Enrollment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All enrollment</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Columns3 className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-2 space-y-2">
                {columns.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={visibleColumns.includes(c.key)}
                      onCheckedChange={() => onToggleColumn(c.key)}
                      disabled={c.key === 'name'}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
      <Label className="sr-only">Student CRM filters</Label>
    </div>
  );
}
