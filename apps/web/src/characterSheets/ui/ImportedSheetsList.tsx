import type { ImportedSheetRecord } from '../types';

type ImportedSheetsListProps = {
  imports: ImportedSheetRecord[];
  selectedImportId: string | null;
  onSelectImport: (importId: string) => void;
  onDeleteImport: (importId: string) => void;
};

const statusClasses: Record<ImportedSheetRecord['importStatus'], string> = {
  ok: 'border-emerald-500/50 bg-emerald-900/30 text-emerald-200',
  warning: 'border-amber-500/50 bg-amber-900/30 text-amber-200',
  error: 'border-rose-500/50 bg-rose-900/30 text-rose-200'
};

const statusLabel: Record<ImportedSheetRecord['importStatus'], string> = {
  ok: 'OK',
  warning: 'Warning',
  error: 'Error'
};

export const ImportedSheetsList = ({
  imports,
  selectedImportId,
  onSelectImport,
  onDeleteImport
}: ImportedSheetsListProps) => {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-lg font-semibold tracking-tight">Saved local character imports</h3>
      <p className="mt-1 text-sm text-slate-300">
        Reopen previously imported sheets without uploading the PDF again.
      </p>

      {imports.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
          No local imports yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {imports.map((record) => {
            const selected = selectedImportId === record.id;
            return (
              <li key={record.id}>
                <div
                  className={`rounded-lg border px-3 py-3 ${
                    selected
                      ? 'border-sky-500/70 bg-sky-950/30'
                      : 'border-slate-700 bg-slate-950/55 hover:border-slate-600'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectImport(record.id)}
                    className="w-full text-left"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-100">{record.sourceFileName}</p>
                      <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${statusClasses[record.importStatus]}`}>
                        {statusLabel[record.importStatus]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {record.templateTitle ?? 'Unknown template'} |{' '}
                      {new Date(record.updatedAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {record.validationSummary.warnings} warnings | {record.validationSummary.errors} errors
                    </p>
                  </button>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteImport(record.id);
                      }}
                      className="rounded border border-rose-500/40 bg-rose-950/30 px-2 py-1 text-xs font-semibold text-rose-200 hover:border-rose-400/70"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
