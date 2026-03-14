import {
  CHARACTER_RULESET_LABELS,
  isImplementedCharacterRuleset,
  type CharacterRecord,
  type CharacterRuleset
} from '../../model/character';
import type { RulesetContentPolicy } from '../../rules/rulesetContentPolicy';

const RULESET_DESCRIPTIONS: Record<CharacterRuleset, string> = {
  DND5E_2014: 'Current guided builder flow with race, subrace, and SRD 5.1 content.',
  DND55_2024: 'Reserved for the future SRD 5.2 builder flow. This option is a placeholder for now.'
};

export const RulesetStep = (props: {
  character: CharacterRecord;
  defaultRuleset: CharacterRuleset;
  contentPolicy: RulesetContentPolicy;
  availableCounts: {
    classes: number;
    races: number;
    backgrounds: number;
  };
  onRulesetChange: (ruleset: CharacterRuleset) => void;
  onDefaultRulesetChange: (ruleset: CharacterRuleset) => void;
}) => {
  const activeRuleset = props.character.ruleset;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        {(Object.keys(CHARACTER_RULESET_LABELS) as CharacterRuleset[]).map((ruleset) => {
          const selected = activeRuleset === ruleset;
          const isDefault = props.defaultRuleset === ruleset;
          const implemented = isImplementedCharacterRuleset(ruleset);

          return (
            <button
              key={ruleset}
              type="button"
              onClick={() => props.onRulesetChange(ruleset)}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? 'border-sky-500/80 bg-sky-950/35'
                  : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-slate-100">
                    {CHARACTER_RULESET_LABELS[ruleset]}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">{RULESET_DESCRIPTIONS[ruleset]}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isDefault ? (
                    <span className="rounded-full border border-emerald-500/60 bg-emerald-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                      Default
                    </span>
                  ) : null}
                  {!implemented ? (
                    <span className="rounded-full border border-amber-500/60 bg-amber-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                      Placeholder
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">Allowed builder content</p>
            <p className="mt-1 text-sm text-slate-300">
              The current rule set limits what appears in the guided flow.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-300">
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Classes</p>
              <p className="mt-1 text-base font-semibold text-slate-100">{props.availableCounts.classes}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Races</p>
              <p className="mt-1 text-base font-semibold text-slate-100">{props.availableCounts.races}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Backgrounds</p>
              <p className="mt-1 text-base font-semibold text-slate-100">{props.availableCounts.backgrounds}</p>
            </div>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
            <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Classes</dt>
            <dd className="mt-1 text-sm text-slate-200">{props.contentPolicy.classesLabel}</dd>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
            <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Races</dt>
            <dd className="mt-1 text-sm text-slate-200">{props.contentPolicy.racesLabel}</dd>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
            <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Backgrounds</dt>
            <dd className="mt-1 text-sm text-slate-200">{props.contentPolicy.backgroundsLabel}</dd>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
            <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Feats and spells</dt>
            <dd className="mt-1 text-sm text-slate-200">{props.contentPolicy.featsLabel}</dd>
            <dd className="mt-1 text-sm text-slate-300">{props.contentPolicy.spellsLabel}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">Default for new characters</p>
            <p className="mt-1 text-sm text-slate-300">
              New characters currently start with {CHARACTER_RULESET_LABELS[props.defaultRuleset]}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => props.onDefaultRulesetChange(activeRuleset)}
            disabled={activeRuleset === props.defaultRuleset}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeRuleset === props.defaultRuleset
                ? 'cursor-not-allowed border border-slate-700 bg-slate-900/60 text-slate-500'
                : 'border border-slate-600 bg-slate-900/80 text-slate-100 hover:border-sky-500'
            }`}
          >
            {activeRuleset === props.defaultRuleset ? 'Current default' : 'Use current selection as default'}
          </button>
        </div>
      </section>

      {!isImplementedCharacterRuleset(activeRuleset) ? (
        <section className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-4 text-sm text-amber-100">
          DnD5.5 (SRD 5.2) is not available in the guided Character Builder yet. Switch back to DnD5e (SRD 5.1)
          to continue with the current implemented flow.
        </section>
      ) : null}
    </div>
  );
};
