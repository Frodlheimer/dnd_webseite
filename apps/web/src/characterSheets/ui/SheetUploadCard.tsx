import type { ChangeEvent, RefObject } from 'react';

type SheetUploadCardProps = {
  busy: boolean;
  error: string | null;
  importInputRef: RefObject<HTMLInputElement | null>;
  onOpenFilePicker: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export const SheetUploadCard = ({
  busy,
  error,
  importInputRef,
  onOpenFilePicker,
  onFileChange
}: SheetUploadCardProps) => {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/65 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Import</p>
      <h3 className="mt-1 text-xl font-semibold tracking-tight">Upload filled PDF</h3>
      <p className="mt-2 text-sm text-slate-300">
        Import any supported character sheet template. Matching, parsing, validation, and storage run fully
        client-side.
      </p>
      <button
        type="button"
        onClick={onOpenFilePicker}
        disabled={busy}
        className="mt-4 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-sky-500/70 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Importing...' : 'Upload filled character sheet PDF'}
      </button>
      <input
        ref={importInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        aria-label="Upload filled character sheet PDF"
        onChange={onFileChange}
      />
      {error ? (
        <p className="mt-3 rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
    </section>
  );
};
