import type { BackgroundStructuredData } from '../model';

const FactCard = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/55 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-100">{value}</p>
    </div>
  );
};

const formatChoices = (choice: { choose: number; from: string[] } | null | undefined) => {
  if (!choice) {
    return null;
  }
  return `Choose ${choice.choose} from ${choice.from.join(', ')}`;
};

const formatEquipmentSummary = (background: BackgroundStructuredData): string | null => {
  const parts = [
    ...background.equipment.fixedItems.slice(0, 4).map((item) =>
      item.quantity && item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name
    ),
    ...background.equipment.choiceGroups
      .slice(0, 2)
      .map((group) => `Choice: ${group.label ?? group.options.map((option) => option.name).join(' / ')}`),
    background.equipment.coins?.gp ? `${background.equipment.coins.gp} gp` : null
  ].filter((entry): entry is string => Boolean(entry));

  if (parts.length === 0) {
    return null;
  }
  return parts.join(' | ');
};

export const BackgroundFactsPanel = ({ background }: { background: BackgroundStructuredData }) => {
  const rows = [
    background.grants.skills.length > 0 || background.grants.skillChoices
      ? {
          label: 'Skills',
          value:
            background.grants.skills.join(', ') || formatChoices(background.grants.skillChoices) || 'None'
        }
      : null,
    background.grants.tools.length > 0 || background.grants.toolChoices
      ? {
          label: 'Tools',
          value:
            background.grants.tools.join(', ') || formatChoices(background.grants.toolChoices) || 'None'
        }
      : null,
    background.grants.languages.length > 0 || background.grants.languageChoices
      ? {
          label: 'Languages',
          value:
            background.grants.languages.join(', ') ||
            formatChoices(background.grants.languageChoices) ||
            'None'
        }
      : null,
    background.feature.name
      ? {
          label: 'Feature',
          value: background.feature.name
        }
      : null,
    formatEquipmentSummary(background)
      ? {
          label: 'Equipment',
          value: formatEquipmentSummary(background) ?? ''
        }
      : null
  ].filter((row): row is { label: string; value: string } => !!row);

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Quick Facts</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map((row) => (
          <FactCard key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </section>
  );
};
