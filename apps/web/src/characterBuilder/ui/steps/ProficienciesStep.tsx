import type { CharacterRecord } from '../../model/character';

export const ProficienciesStep = (props: {
  character: CharacterRecord;
  classSkillChoice: {
    choose: number;
    options: string[];
  };
  onSkillsChange: (skills: string[]) => void;
}) => {
  const selectedSkills = props.character.proficiencies.skills;
  const selectedSet = new Set(selectedSkills);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
        <p className="text-sm font-medium text-slate-100">
          Class skills ({selectedSkills.length}/{props.classSkillChoice.choose || 0})
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {props.classSkillChoice.options.map((skill) => {
            const checked = selectedSet.has(skill);
            const atLimit =
              !checked &&
              props.classSkillChoice.choose > 0 &&
              selectedSkills.length >= props.classSkillChoice.choose;
            return (
              <label key={skill} className={`flex items-center gap-2 text-sm ${atLimit ? 'opacity-60' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={atLimit}
                  onChange={(event) => {
                    if (event.target.checked) {
                      props.onSkillsChange([...selectedSkills, skill]);
                    } else {
                      props.onSkillsChange(selectedSkills.filter((entry) => entry !== skill));
                    }
                  }}
                />
                <span>{skill}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-200">
        <p className="font-medium">Current proficiencies</p>
        <p className="mt-1 text-xs text-slate-300">Saving throws: {props.character.proficiencies.savingThrows.join(', ') || 'None'}</p>
        <p className="mt-1 text-xs text-slate-300">Armor: {props.character.proficiencies.armor.join(', ') || 'None'}</p>
        <p className="mt-1 text-xs text-slate-300">Weapons: {props.character.proficiencies.weapons.join(', ') || 'None'}</p>
        <p className="mt-1 text-xs text-slate-300">Tools: {props.character.proficiencies.tools.join(', ') || 'None'}</p>
        <p className="mt-1 text-xs text-slate-300">Languages: {props.character.proficiencies.languages.join(', ') || 'None'}</p>
      </section>
    </div>
  );
};

