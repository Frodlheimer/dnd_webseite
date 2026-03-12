import type { ImportedSheetRecord } from '../types';

type ImportedSheetSummaryProps = {
  record: ImportedSheetRecord | null;
};

const statusClasses: Record<ImportedSheetRecord['importStatus'], string> = {
  ok: 'border-emerald-500/50 bg-emerald-900/25 text-emerald-200',
  warning: 'border-amber-500/50 bg-amber-900/25 text-amber-200',
  error: 'border-rose-500/50 bg-rose-900/25 text-rose-200'
};

const statusLabel: Record<ImportedSheetRecord['importStatus'], string> = {
  ok: 'OK',
  warning: 'Warning',
  error: 'Error'
};

export const ImportedSheetSummary = ({ record }: ImportedSheetSummaryProps) => {
  if (!record) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
        Select a saved import to view parsed values.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Imported sheet result</h3>
          <p className="mt-1 text-sm text-slate-300">Imported successfully</p>
        </div>
        <span className={`rounded border px-3 py-1 text-xs font-semibold ${statusClasses[record.importStatus]}`}>
          {statusLabel[record.importStatus]}
        </span>
      </div>

      <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
          <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">File name</dt>
          <dd className="mt-1 text-slate-100">{record.sourceFileName}</dd>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
          <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">Detected template</dt>
          <dd className="mt-1 text-slate-100">{record.templateTitle ?? 'Unknown template'}</dd>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
          <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">Import timestamp</dt>
          <dd className="mt-1 text-slate-100">{new Date(record.updatedAt).toLocaleString()}</dd>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
          <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">Validation summary</dt>
          <dd className="mt-1 text-slate-100">
            {record.validationSummary.warnings} warnings | {record.validationSummary.errors} errors
          </dd>
        </div>
      </dl>
    </section>
  );
};
