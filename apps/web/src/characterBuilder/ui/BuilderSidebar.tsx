import { BUILDER_SECTION_LABELS, type BuilderSectionId } from '../model/decisions';

export type SidebarSectionStatus = 'complete' | 'needs_choices' | 'warning' | 'locked';

export type BuilderSidebarItem = {
  id: BuilderSectionId;
  status: SidebarSectionStatus;
  pendingCount: number;
};

const statusStyles: Record<SidebarSectionStatus, string> = {
  complete: 'border-emerald-500/60 bg-emerald-950/30 text-emerald-200',
  needs_choices: 'border-amber-500/60 bg-amber-950/30 text-amber-200',
  warning: 'border-rose-500/60 bg-rose-950/30 text-rose-200',
  locked: 'border-slate-700 bg-slate-900/50 text-slate-400'
};

const statusLabel: Record<SidebarSectionStatus, string> = {
  complete: 'Complete',
  needs_choices: 'Needs choices',
  warning: 'Warning',
  locked: 'Locked'
};

export const BuilderSidebar = (props: {
  items: BuilderSidebarItem[];
  activeSection: BuilderSectionId;
  onSelectSection: (section: BuilderSectionId) => void;
}) => {
  return (
    <aside className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-sky-300">Guided Builder</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-100">Character Progress</h2>
      <div className="mt-4 space-y-2">
        {props.items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => props.onSelectSection(item.id)}
            className={`w-full rounded-lg border p-3 text-left transition ${
              props.activeSection === item.id
                ? 'border-sky-500/70 bg-sky-950/30'
                : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                    props.activeSection === item.id
                      ? 'border-sky-400 bg-sky-950/60 text-sky-100'
                      : 'border-slate-700 bg-slate-950/60 text-slate-300'
                  }`}
                >
                  {index + 1}
                </span>
                <p className="text-sm font-medium text-slate-100">{BUILDER_SECTION_LABELS[item.id]}</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusStyles[item.status]}`}>
                {statusLabel[item.status]}
              </span>
            </div>
            {item.pendingCount > 0 ? (
              <p className="mt-1 text-xs text-amber-300">{item.pendingCount} unresolved decision(s)</p>
            ) : null}
          </button>
        ))}
      </div>
    </aside>
  );
};
