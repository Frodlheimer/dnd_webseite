import type { CharacterSheetTemplateSummary } from '../types';

type GeneralSheetDownloadCardProps = {
  template: CharacterSheetTemplateSummary | null;
  downloading: boolean;
  onDownload: () => void;
};

export const GeneralSheetDownloadCard = ({
  template,
  downloading,
  onDownload
}: GeneralSheetDownloadCardProps) => {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/65 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Download</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">General Character Sheet</h2>
      <p className="mt-2 text-sm text-slate-300">
        Download the blank official general character sheet PDF. This is the only built-in download offered
        directly here.
      </p>
      <p className="mt-2 text-xs text-slate-400">
        {template ? `Template ID: ${template.id} | ${template.pageCount} pages` : 'General sheet template is unavailable.'}
      </p>
      <button
        type="button"
        onClick={onDownload}
        disabled={downloading || !template}
        className="mt-4 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {downloading ? 'Preparing PDF...' : 'Download blank PDF'}
      </button>
    </section>
  );
};
