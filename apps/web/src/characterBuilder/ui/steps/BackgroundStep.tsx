import type { CharacterRecord } from '../../model/character';
import type { BuilderBackground } from '../../rules/rulesFacade';
import { RuleReferenceButton } from '../RuleReferenceButton';

const parseCsv = (value: string): string[] => {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const BackgroundStep = (props: {
  character: CharacterRecord;
  backgrounds: BuilderBackground[];
  originRuntime: {
    backgroundLanguageChoices: number;
    backgroundLanguageOptions: string[];
    backgroundToolChoices: number;
    backgroundToolOptions: string[];
    backgroundSkillChoices: number;
    backgroundSkillOptions: string[];
  };
  onBackgroundChange: (backgroundId: string) => void;
  onBackgroundLanguagesChange: (values: string[]) => void;
  onBackgroundToolsChange: (values: string[]) => void;
  onBackgroundSkillsChange: (values: string[]) => void;
  onOpenBackgroundReference: (backgroundId: string) => void;
}) => {
  const backgroundLanguageText = props.character.origin.selectedBackgroundLanguages.join(', ');
  const backgroundToolText = props.character.origin.selectedBackgroundToolProficiencies.join(', ');
  const backgroundSkillText = props.character.origin.selectedBackgroundSkills.join(', ');

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-slate-100">Choose background</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {props.backgrounds.map((background) => (
            <article
              key={background.id}
              className={`rounded-lg border p-3 text-left ${
                props.character.origin.backgroundId === background.id
                  ? 'border-sky-500/80 bg-sky-950/35'
                  : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => props.onBackgroundChange(background.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-sm font-semibold text-slate-100">{background.name}</p>
                  <p className="mt-1 text-xs text-slate-300">{background.summary}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Skills: {background.skillProficiencies.join(', ') || 'None'} | Tools:{' '}
                    {background.toolProficiencies.join(', ') || 'None'}
                    {background.languageChoices > 0 || background.languagesGranted.length > 0
                      ? ` | Languages: ${background.languagesGranted.join(', ') || `${background.languageChoices} choice`}`
                      : ''}
                  </p>
                </button>
                <RuleReferenceButton
                  label={`Open background reference for ${background.name}`}
                  onClick={() => props.onOpenBackgroundReference(background.id)}
                />
              </div>
            </article>
          ))}
        </div>
      </div>

      {props.originRuntime.backgroundLanguageChoices > 0 ||
      props.originRuntime.backgroundToolChoices > 0 ||
      props.originRuntime.backgroundSkillChoices > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {props.originRuntime.backgroundLanguageChoices > 0 ? (
            <label className="text-sm text-slate-200">
              Background languages ({props.originRuntime.backgroundLanguageChoices})
              <input
                value={backgroundLanguageText}
                onChange={(event) => props.onBackgroundLanguagesChange(parseCsv(event.target.value))}
                placeholder={props.originRuntime.backgroundLanguageOptions.join(', ') || 'Common, Elvish'}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </label>
          ) : null}
          {props.originRuntime.backgroundToolChoices > 0 ? (
            <label className="text-sm text-slate-200">
              Background tools ({props.originRuntime.backgroundToolChoices})
              <input
                value={backgroundToolText}
                onChange={(event) => props.onBackgroundToolsChange(parseCsv(event.target.value))}
                placeholder={props.originRuntime.backgroundToolOptions.join(', ') || 'Calligrapher tools'}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </label>
          ) : null}
          {props.originRuntime.backgroundSkillChoices > 0 ? (
            <label className="text-sm text-slate-200 sm:col-span-2">
              Background skills ({props.originRuntime.backgroundSkillChoices})
              <input
                value={backgroundSkillText}
                onChange={(event) => props.onBackgroundSkillsChange(parseCsv(event.target.value))}
                placeholder={props.originRuntime.backgroundSkillOptions.join(', ') || 'Choose skills'}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
