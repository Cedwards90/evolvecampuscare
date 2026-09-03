import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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
  nextOffset?: number | null;
  complete?: boolean;
}

export interface ExportProgress {
  current: number;
  total: number;
  table: string;
}

function appendCsv(existing: ExportFile | undefined, incoming: ExportFile): ExportFile {
  if (!existing) return incoming;
  const normalized = incoming.csv.replace(/^\uFEFF/, '');
  const newline = normalized.indexOf('\n');
  const rowsOnly = newline >= 0 ? normalized.slice(newline + 1) : '';
  return { ...existing, csv: existing.csv + rowsOnly, rows: existing.rows + incoming.rows };
}

export function useRunExport() {
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const mutation = useMutation({
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

      let flatBatch = false;
      let tables: string[] = [];

      if (allTime) {
        // Discover every table that actually has rows, unfiltered.
        const manifest = await invokeExport<{ tables: ExportManifestTable[] }>({
          action: 'manifest',
          from: null,
          to: null,
          orgIds: [],
          cohortIds: [],
        });
        tables = (manifest?.tables ?? []).filter((t) => (t.rows ?? 0) > 0).map((t) => t.table);
        flatBatch = true;
      } else if (opts.action === 'flat') {
        flatBatch = true;
      } else {
        tables = opts.tables ?? [];
      }

      if (!flatBatch && !tables.length) throw new Error('Select at least one table to export.');

      const fileMap = new Map<string, ExportFile>();
      const truncated: string[] = [];
      const failed: { table: string; error: string }[] = [];
      let totalRows = 0;

      if (flatBatch) {
        setProgress({ current: 0, total: tables.length + 1, table: 'Ready-made reports' });
        try {
          const res = await invokeExport<ExportResponse>({ action: 'flat', ...base });
          if (!Array.isArray(res?.files)) throw new Error('Unexpected response');
          res.files.forEach((file) => fileMap.set(file.name, file));
          totalRows += res.totalRows ?? 0;
        } catch (error) {
          failed.push({ table: 'ready-made reports', error: error instanceof Error ? error.message : 'Export failed' });
        }
      }

      for (let index = 0; index < tables.length; index++) {
        const table = tables[index];
        setProgress({ current: index + (flatBatch ? 1 : 0), total: tables.length + (flatBatch ? 1 : 0), table });
        let offset = 0;
        try {
          for (;;) {
            const res = await invokeExport<ExportResponse>({ action: 'export', tables: [table], offset, ...base });
            if (!Array.isArray(res?.files)) throw new Error('Unexpected response');
            res.files.forEach((file) => fileMap.set(file.name, appendCsv(fileMap.get(file.name), file)));
            totalRows += res.totalRows ?? 0;
            truncated.push(...(res.truncated ?? []));
            if (res.complete !== false || res.nextOffset == null) break;
            if (res.nextOffset <= offset) throw new Error('Export pagination did not advance');
            offset = res.nextOffset;
          }
        } catch (error) {
          failed.push({ table, error: error instanceof Error ? error.message : 'Export failed' });
        }
      }

      setProgress(null);
      const files = [...fileMap.values()];
      if (!files.length && failed.length) throw new Error(`${failed[0].table}: ${failed[0].error}`);

      const ready = files.filter((f) => f.csv.length > 0);
      if (!ready.length) return { files, totalRows, truncated, failed, downloaded: 0 };

      if ((allTime || opts.bundle === 'zip') && ready.length > 1) {
        const zip = new JSZip();
        ready.forEach((f) => zip.file(f.name, f.csv));
        zip.file(
          'manifest.csv',
          'file,rows,status,error\n' +
            ready.map((f) => `${f.name},${f.rows},complete,`).join('\n') +
            (failed.length ? `\n${failed.map((f) => `${f.table},0,failed,"${f.error.replace(/"/g, '""')}"`).join('\n')}` : '') +
            '\n',
        );
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, `evolve-${allTime ? 'all-time' : 'data'}-export_${stamp()}.zip`);
      } else {
        ready.forEach((f) =>
          downloadBlob(new Blob([f.csv], { type: 'text/csv;charset=utf-8' }), f.name),
        );
      }
      return { files, totalRows, truncated, failed, downloaded: ready.length };
    },
    onSettled: () => setProgress(null),
  });
  return { ...mutation, progress };
}

