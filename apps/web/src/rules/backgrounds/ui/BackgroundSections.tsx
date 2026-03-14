import type { ReactNode } from 'react';

import type { BackgroundStructuredData } from '../model';

const CardSection = ({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) => {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
};

const DataGrid = ({ rows }: { rows: Array<{ label: string; value: string }> }) => {
  if (rows.length === 0) {
    return null;
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3">
          <dt className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{row.label}</dt>
          <dd className="mt-1 text-sm text-slate-100">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
};

const formatChoice = (choice: { choose: number; from: string[] } | null | undefined) => {
  if (!choice) {
    return null;
  }
  return `Choose ${choice.choose} from ${choice.from.join(', ')}`;
};

export const BackgroundSections = ({ background }: { background: BackgroundStructuredData }) => {
  const proficiencyRows = [
    background.grants.skills.length > 0
      ? {
          label: 'Granted skills',
          value: background.grants.skills.join(', ')
        }
      : null,
    background.grants.skillChoices
      ? {
          label: 'Skill choices',
          value: formatChoice(background.grants.skillChoices) ?? ''
        }
      : null,
    background.grants.tools.length > 0
      ? {
          label: 'Granted tools',
          value: background.grants.tools.join(', ')
        }
      : null,
    background.grants.toolChoices
      ? {
          label: 'Tool choices',
          value: formatChoice(background.grants.toolChoices) ?? ''
        }
      : null,
    background.grants.languages.length > 0
      ? {
          label: 'Granted languages',
          value: background.grants.languages.join(', ')
        }
      : null,
    background.grants.languageChoices
      ? {
          label: 'Language choices',
          value: formatChoice(background.grants.languageChoices) ?? ''
        }
      : null
  ].filter((row): row is { label: string; value: string } => !!row);

  const personalityRows = [
    background.personality?.traits?.length
      ? {
          label: 'Traits',
          value: background.personality.traits.join(' | ')
        }
      : null,
    background.personality?.ideals?.length
      ? {
          label: 'Ideals',
          value: background.personality.ideals.join(' | ')
        }
      : null,
    background.personality?.bonds?.length
      ? {
          label: 'Bonds',
          value: background.personality.bonds.join(' | ')
        }
      : null,
    background.personality?.flaws?.length
      ? {
          label: 'Flaws',
          value: background.personality.flaws.join(' | ')
        }
      : null
  ].filter((row): row is { label: string; value: string } => !!row);

  const variants = background.structuredSections.filter((section) => section.kind === 'variant' && section.text);

  return (
    <div className="space-y-4">
      {proficiencyRows.length > 0 ? (
        <CardSection title="Proficiencies">
          <DataGrid rows={proficiencyRows} />
        </CardSection>
      ) : null}

      {background.feature.name || background.feature.rulesText ? (
        <CardSection title="Feature">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-4">
            {background.feature.name ? (
              <h4 className="text-base font-semibold text-slate-100">{background.feature.name}</h4>
            ) : null}
            {background.feature.summary ? (
              <p className="mt-2 text-sm text-slate-300">{background.feature.summary}</p>
            ) : null}
            {background.feature.rulesText ? (
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-200">
                {background.feature.rulesText}
              </p>
            ) : null}
          </div>
        </CardSection>
      ) : null}

      {background.equipment.fixedItems.length > 0 ||
      background.equipment.choiceGroups.length > 0 ||
      background.equipment.coins ? (
        <CardSection title="Equipment">
          <div className="space-y-3">
            {background.equipment.fixedItems.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {background.equipment.fixedItems.map((item, index) => (
                  <li
                    key={`${item.name}-${index}`}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3 text-sm text-slate-100"
                  >
                    {item.quantity && item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name}
                  </li>
                ))}
              </ul>
            ) : null}

            {background.equipment.choiceGroups.length > 0 ? (
              <div className="space-y-2">
                {background.equipment.choiceGroups.map((group, index) => (
                  <div
                    key={`equipment-choice-${index}`}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3"
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Choose {group.choose}
                    </p>
                    <p className="mt-1 text-sm text-slate-100">
                      {group.label ?? group.options.map((option) => option.name).join(' / ')}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {background.equipment.coins ? (
              <p className="text-sm text-slate-300">
                Coins:{' '}
                {Object.entries(background.equipment.coins)
                  .map(([coin, amount]) => `${amount} ${coin}`)
                  .join(', ')}
              </p>
            ) : null}

            {background.equipment.rawText ? (
              <p className="text-sm text-slate-400">{background.equipment.rawText}</p>
            ) : null}
          </div>
        </CardSection>
      ) : null}

      {personalityRows.length > 0 ? (
        <CardSection title="Personality & Roleplay">
          <DataGrid rows={personalityRows} />
        </CardSection>
      ) : null}

      {variants.length > 0 ? (
        <CardSection title="Variants">
          <div className="grid gap-3 sm:grid-cols-2">
            {variants.map((variant) => (
              <article
                key={variant.id}
                className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-4"
              >
                <h4 className="text-base font-semibold text-slate-100">{variant.title}</h4>
                <p className="mt-2 text-sm leading-7 text-slate-300">{variant.text}</p>
              </article>
            ))}
          </div>
        </CardSection>
      ) : null}
    </div>
  );
};
