import { useMutation, useQuery } from '@tanstack/react-query';
import JSZip from 'jszip';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export interface ExportManifestTable {
  table: string;
  label: string;
  group: string;
  dateColumn: string | null;
  rows: number | null;
}

export interface ExportFilters {
  from?: string | null;
  to?: string | null;
  orgIds?: string[];
  cohortIds?: string[];
  includeSensitive: boolean;
}

interface ExportFile {
  name: string;
  csv: string;
  rows: number;
}

async function invokeExport<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('export-data', { body });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export function useExportManifest(filters: ExportFilters) {
  return useQuery({
    queryKey: ['export-manifest', filters.from, filters.to, filters.orgIds, filters.cohortIds],
    queryFn: () =>
      invokeExport<{ tables: ExportManifestTable[]; scoped: boolean }>({
        action: 'manifest',
        from: filters.from ?? null,
        to: filters.to ?? null,
        orgIds: filters.orgIds ?? [],
        cohortIds: filters.cohortIds ?? [],
      }),
    staleTime: 60_000,
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const stamp = () => format(new Date(), 'yyyy-MM-dd');

interface ExportResponse {
  files?: ExportFile[];
  totalRows?: number;
  truncated?: string[];
}

export function useRunExport() {
  return useMutation({
    mutationFn: async (opts: {
      action: 'export' | 'flat' | 'all-time';
      tables?: string[];
      filters: ExportFilters;
      bundle: 'zip' | 'files';
    }) => {
      const allTime = opts.action === 'all-time';

      const base = {
        from: allTime ? null : opts.filters.from ?? null,
        to: allTime ? null : opts.filters.to ?? null,
        orgIds: allTime ? [] : opts.filters.orgIds ?? [],
        cohortIds: allTime ? [] : opts.filters.cohortIds ?? [],
        includeSensitive: allTime ? true : opts.filters.includeSensitive,
        format: allTime ? 'zip' : opts.bundle,
      };

      let batches: Record<string, unknown>[];

      if (allTime) {
        // Discover every table that actually has rows, unfiltered.
        const manifest = await invokeExport<{ tables: ExportManifestTable[] }>({
          action: 'manifest',
          from: null,
          to: null,
          orgIds: [],
          cohortIds: [],
        });
        const tables = (manifest?.tables ?? []).filter((t) => (t.rows ?? 0) > 0).map((t) => t.table);
        batches = [
          { action: 'flat', ...base },
          ...tables.map((table) => ({ action: 'export', tables: [table], ...base })),
        ];
      } else if (opts.action === 'flat') {
        batches = [{ action: 'flat', ...base }];
      } else {
        // Request one table per call so a large selection never exceeds the
        // edge function's response limit.
        batches = (opts.tables ?? []).map((table) => ({ action: 'export', tables: [table], ...base }));
      }

      if (!batches.length) throw new Error('Select at least one table to export.');

      const files: ExportFile[] = [];
      const truncated: string[] = [];
      let totalRows = 0;

      for (const body of batches) {
        const res = await invokeExport<ExportResponse>(body);
        if (!Array.isArray(res?.files)) {
          throw new Error('The export service returned an unexpected response. Please try again.');
        }
        files.push(...res.files);
        truncated.push(...(res.truncated ?? []));
        totalRows += res.totalRows ?? 0;
      }

      const ready = files.filter((f) => f.csv.length > 0);
      if (!ready.length) return { files, totalRows, truncated, downloaded: 0 };

      if (opts.bundle === 'zip' && ready.length > 1) {
        const zip = new JSZip();
        ready.forEach((f) => zip.file(f.name, f.csv));
        zip.file(
          'manifest.csv',
          'file,rows\n' + ready.map((f) => `${f.name},${f.rows}`).join('\n') + '\n',
        );
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, `evolve-data-export_${stamp()}.zip`);
      } else {
        ready.forEach((f) =>
          downloadBlob(new Blob([f.csv], { type: 'text/csv;charset=utf-8' }), f.name),
        );
      }
      return { files, totalRows, truncated, downloaded: ready.length };
    },
  });
}

