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

export function useRunExport() {
  return useMutation({
    mutationFn: async (opts: {
      action: 'export' | 'flat';
      tables?: string[];
      filters: ExportFilters;
      bundle: 'zip' | 'files';
    }) => {
      const res = await invokeExport<{ files: ExportFile[]; totalRows: number }>({
        action: opts.action,
        tables: opts.tables ?? [],
        from: opts.filters.from ?? null,
        to: opts.filters.to ?? null,
        orgIds: opts.filters.orgIds ?? [],
        cohortIds: opts.filters.cohortIds ?? [],
        includeSensitive: opts.filters.includeSensitive,
        format: opts.bundle,
      });

      const files = res.files.filter((f) => f.csv.length > 0);
      if (!files.length) return { ...res, downloaded: 0 };

      if (opts.bundle === 'zip' && files.length > 1) {
        const zip = new JSZip();
        files.forEach((f) => zip.file(f.name, f.csv));
        zip.file(
          'manifest.csv',
          'file,rows\n' + files.map((f) => `${f.name},${f.rows}`).join('\n') + '\n',
        );
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, `evolve-data-export_${stamp()}.zip`);
      } else {
        files.forEach((f) =>
          downloadBlob(new Blob([f.csv], { type: 'text/csv;charset=utf-8' }), f.name),
        );
      }
      return { ...res, downloaded: files.length };
    },
  });
}
