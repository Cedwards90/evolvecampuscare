import { MoreHorizontal, ExternalLink, Pencil, GraduationCap, UserCheck, Power } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/utils';
import type { StudentCrmRow } from '@/hooks/useStudentCrm';
import { CRM_COLUMNS, displayName, legalName, fullAddress } from './crmColumns';

interface StudentCrmTableProps {
  rows: StudentCrmRow[];
  visibleColumns: string[];
  canSeeSensitive: boolean;
  canManageEnrollment: boolean;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpen: (row: StudentCrmRow) => void;
  onEditProfile: (row: StudentCrmRow) => void;
  onToggleActive: (row: StudentCrmRow) => void;
}

const dash = <span className="text-muted-foreground">—</span>;

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString() : null);

export function StudentCrmTable({
  rows,
  visibleColumns,
  canSeeSensitive,
  canManageEnrollment,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onOpen,
  onEditProfile,
  onToggleActive,
}: StudentCrmTableProps) {
  const columns = CRM_COLUMNS.filter(
    (c) => visibleColumns.includes(c.key) && (canSeeSensitive || !c.sensitive),
  );

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.user_id));

  const cell = (row: StudentCrmRow, key: string) => {
    switch (key) {
      case 'name': {
        const legal = legalName(row);
        return (
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onOpen(row)}
              className="font-medium text-left hover:underline break-words"
            >
              {displayName(row)}
            </button>
            {legal && legal !== displayName(row) && (
              <p className="text-xs text-muted-foreground break-words">Legal: {legal}</p>
            )}
          </div>
        );
      }
      case 'student_id':
        return row.student_id || dash;
      case 'email':
        return <span className="text-sm break-all">{row.email}</span>;
      case 'phone':
        return row.phone || dash;
      case 'organization':
        return row.organization_name || dash;
      case 'cohort':
        return row.cohort_name ? <Badge variant="outline">{row.cohort_name}</Badge> : dash;
      case 'case_manager':
        return row.case_manager_name || <span className="text-xs text-muted-foreground">Unassigned</span>;
      case 'status':
        return row.is_active ? (
          <Badge variant="outline" className="border-primary/40 text-primary">Active</Badge>
        ) : (
          <Badge variant="secondary" title={row.deactivation_reason || undefined}>Inactive</Badge>
        );
      case 'age':
        return row.age !== null ? row.age : dash;
      case 'date_of_birth':
        return fmtDate(row.date_of_birth) || dash;
      case 'address':
        return <span className="text-sm break-words">{fullAddress(row) || '—'}</span>;
      case 'cohort_start_date':
        return fmtDate(row.cohort_start_date) || dash;
      case 'graduation_date':
        return fmtDate(row.graduation_date) || dash;
      case 'placement_date':
        return fmtDate(row.placement_date) || dash;
      case 'open_requests':
        return <span className="tabular-nums">{row.open_requests}</span>;
      case 'dispersed':
        return <span className="tabular-nums">{formatCurrency(row.dispersed)}</span>;
      case 'last_activity':
        return fmtDate(row.last_activity_at) || <span className="text-xs text-muted-foreground">No activity</span>;
      case 'joined':
        return fmtDate(row.created_at) || dash;
      default:
        return dash;
    }
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleSelectAll}
                aria-label="Select all students shown"
              />
            </TableHead>
            {columns.map((c) => (
              <TableHead key={c.key} className={c.align === 'right' ? 'text-right' : undefined}>
                {c.label}
              </TableHead>
            ))}
            <TableHead className="w-[60px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.user_id} data-state={selected.has(row.user_id) ? 'selected' : undefined}>
              <TableCell>
                <Checkbox
                  checked={selected.has(row.user_id)}
                  onCheckedChange={() => onToggleSelect(row.user_id)}
                  aria-label={`Select ${displayName(row)}`}
                />
              </TableCell>
              {columns.map((c) => (
                <TableCell key={c.key} className={c.align === 'right' ? 'text-right' : undefined}>
                  {cell(row, c.key)}
                </TableCell>
              ))}
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onOpen(row)}>
                      <GraduationCap className="mr-2 h-4 w-4" />
                      Open record
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEditProfile(row)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/students/${row.user_id}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Full student file
                      </Link>
                    </DropdownMenuItem>
                    {canManageEnrollment && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onToggleActive(row)}>
                          <Power className="mr-2 h-4 w-4" />
                          {row.is_active ? 'Deactivate enrollment' : 'Reactivate enrollment'}
                        </DropdownMenuItem>
                      </>
                    )}
                    {!canManageEnrollment && (
                      <DropdownMenuItem disabled>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Enrollment managed by admins
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
