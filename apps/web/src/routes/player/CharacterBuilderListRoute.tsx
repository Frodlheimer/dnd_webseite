import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { deriveCharacter } from '../../characterBuilder/engine/deriveCharacter';
import { CHARACTER_RULESET_LABELS, type CharacterRecord } from '../../characterBuilder/model/character';
import { characterRepository } from '../../characterBuilder/storage/characterRepository';
import { getDefaultCharacterRuleset } from '../../characterBuilder/settings/rulesetPreferences';
import { characterSheetsRepository } from '../../characterSheets/storage/characterSheetsRepository';
import type { ImportedSheetRecord } from '../../characterSheets/types';
import { rulesFacade } from '../../characterBuilder/rules/rulesFacade';

type CharacterCardView = {
  character: CharacterRecord;
  className: string | null;
  subclassName: string | null;
  raceName: string | null;
  backgroundName: string | null;
};

const formatTimestamp = (value: number): string => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(value);
  } catch {
    return `${value}`;
  }
};

export const CharacterBuilderListRoute = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterCardView[]>([]);
  const [importedSheets, setImportedSheets] = useState<ImportedSheetRecord[]>([]);
  const defaultRulesetLabel = useMemo(() => {
    return CHARACTER_RULESET_LABELS[getDefaultCharacterRuleset()];
  }, []);

  const load = useCallback(async () => {
    const records = await characterRepository.listCharacters();
    const derivedRows = await Promise.all(
      records.map(async (record) => {
        const derived = await deriveCharacter(record);
        const character = derived.character;
        const className = character.progression.classId
          ? rulesFacade.findClassName(character.progression.classId)
          : null;
        const subclassName = character.progression.subclassId
          ? rulesFacade.findSubclassName(character.progression.subclassId)
          : null;
        const raceName = await rulesFacade.findRaceName(character.origin.raceId);
        const backgroundName = character.origin.backgroundId
          ? rulesFacade.getBackgroundById(character.origin.backgroundId)?.name ?? character.origin.backgroundId
          : null;
        return {
          character,
          className,
          subclassName,
          raceName,
          backgroundName
        } satisfies CharacterCardView;
      })
    );
    setCharacters(derivedRows.sort((a, b) => b.character.updatedAt - a.character.updatedAt));
    const imported = await characterSheetsRepository.listImportedSheetRecords(30);
    setImportedSheets(imported);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load()
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load characters.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const hasCharacters = characters.length > 0;
  const hasImported = importedSheets.length > 0;

  const statusClass = useMemo(() => {
    return (status: CharacterRecord['status']) => {
      if (status === 'ready') {
        return 'border-emerald-500/60 bg-emerald-950/30 text-emerald-200';
      }
      if (status === 'invalid') {
        return 'border-rose-500/60 bg-rose-950/30 text-rose-200';
      }
      if (status === 'in_progress') {
        return 'border-amber-500/60 bg-amber-950/30 text-amber-200';
      }
      return 'border-slate-700 bg-slate-900/70 text-slate-300';
    };
  }, []);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/player/characters" className="text-xs uppercase tracking-[0.2em] text-sky-300 hover:text-sky-200">
              Create a new character
            </Link>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-100">Your Characters</h2>
            <p className="mt-1 text-sm text-slate-300">
              Build and manage local-first characters. No server storage or server processing.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Default rule set for new characters: {defaultRulesetLabel}
            </p>
          </div>
          <Link
            to="/player/characters/new"
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            Create another character
          </Link>
        </div>
      </header>

      {loading ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm text-slate-300">
          Loading characters...
        </section>
      ) : null}

      {error ? (
        <section className="rounded-xl border border-rose-600/40 bg-rose-950/20 p-4 text-sm text-rose-100">
          {error}
        </section>
      ) : null}

      {!loading && !hasCharacters ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm text-slate-300">
          No builder characters yet. Start your first character from{' '}
          <Link to="/player/characters/new" className="text-sky-300 hover:underline">
            Start Character Builder
          </Link>
          .
        </section>
      ) : null}

      {hasCharacters ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {characters.map(({ character, className, subclassName, raceName, backgroundName }) => (
            <article key={character.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{character.meta.name || 'Unnamed Character'}</h3>
                  <p className="text-xs text-slate-300">
                    {className ?? 'Class TBD'}
                    {subclassName ? ` / ${subclassName}` : ''} | Level {character.progression.level}
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusClass(character.status)}`}>
                  {character.status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                <p>Race/Species: {raceName ?? 'Not selected'}</p>
                <p>Background: {backgroundName ?? 'Not selected'}</p>
                <p>AC: {character.derived.armorClass ?? '-'}</p>
                <p>HP: {character.derived.hitPointsMax ?? '-'}</p>
                <p>
                  Initiative: {character.derived.initiative >= 0 ? '+' : ''}
                  {character.derived.initiative}
                </p>
                <p>Prof: +{character.derived.proficiencyBonus}</p>
              </div>

              <p className="mt-2 text-[11px] text-slate-400">Updated {formatTimestamp(character.updatedAt)}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`/player/characters/${character.id}`}
                  className="rounded-md border border-slate-600 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 hover:border-sky-500"
                >
                  Continue editing
                </Link>
                <Link
                  to={`/player/characters/${character.id}/review`}
                  className="rounded-md border border-slate-600 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 hover:border-sky-500"
                >
                  Review / Export
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    void characterRepository.duplicateCharacter(character.id).then(() => load());
                  }}
                  className="rounded-md border border-slate-600 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 hover:border-sky-500"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void characterRepository.deleteCharacter(character.id).then(() => load());
                  }}
                  className="rounded-md border border-rose-600/60 bg-rose-950/30 px-2.5 py-1.5 text-xs text-rose-100"
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-600 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-300"
                  disabled
                  title="Placeholder for future in-session handoff"
                >
                  Use later in session
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {hasImported ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-100">Imported Sheet Characters</h3>
            <Link to="/player/characters/sheets" className="text-xs text-sky-300 hover:underline">
              Open Character Sheets
            </Link>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {importedSheets.map((record) => (
              <article key={record.id} className="rounded-lg border border-slate-700 bg-slate-950/35 p-3 text-xs">
                <p className="font-medium text-slate-100">{record.sourceFileName}</p>
                <p className="mt-1 text-slate-300">
                  Status: {record.importStatus} | Errors: {record.validationSummary.errors} | Warnings:{' '}
                  {record.validationSummary.warnings}
                </p>
                <p className="mt-1 text-slate-400">Updated {formatTimestamp(record.updatedAt)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
};
