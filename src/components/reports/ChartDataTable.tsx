/**
 * Accessible text alternative for a chart.
 *
 * Recharts output is not readable by screen readers and is useless to anyone
 * who can't perceive colour differences, so every chart on a reporting surface
 * ships with the same numbers as a real table.
 */

import { useState } from 'react';
import { Table as TableIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface ChartDataTableColumn<T> {
  key: string;
  label: string;
  value: (row: T) => string | number;
}

interface ChartDataTableProps<T> {
  /** Describes the chart for assistive tech, e.g. "Daily request volume". */
  caption: string;
  rows: T[];
  columns: ChartDataTableColumn<T>[];
  /** Row key accessor. */
  rowKey: (row: T, index: number) => string;
}

export function ChartDataTable<T>({ caption, rows, columns, rowKey }: ChartDataTableProps<T>) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 rounded-full px-2 text-xs text-muted-foreground"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <TableIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        {open ? 'Hide data table' : 'View data table'}
      </Button>

      {open && (
        <div className="mt-2 max-h-72 overflow-auto rounded-xl border">
          <Table>
            <caption className="sr-only">{caption}</caption>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key} scope="col" className="text-xs">
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={rowKey(row, i)}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className="text-xs">
                      {c.value(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
