import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { mapCharacterToGeneralSheetValues } from '../../characterBuilder/export/mapCharacterToGeneralSheet';
import { deriveCharacter } from '../../characterBuilder/engine/deriveCharacter';
import type { CharacterRecord } from '../../characterBuilder/model/character';
import { characterRepository } from '../../characterBuilder/storage/characterRepository';
import { ReviewPanel } from '../../characterBuilder/ui/ReviewPanel';
import {
  characterSheetTemplatesIndex,
  loadCharacterSheetTemplate
} from '../../characterSheets/generated/templatesIndex';
import {
  buildCharacterSheetPdfFileName,
  fillPdfTemplate,
  triggerPdfDownload
} from '../../characterSheets/pdf/fillPdf';

const GENERAL_SHEET_DOWNLOAD_FILE_NAME = 'general-character-sheet-blank.pdf';

export const CharacterBuilderReviewRoute = () => {
  const params = useParams<{ characterId: string }>();
  const characterId = params.characterId ?? '';
  const navigate = useNavigate();
  const [character, setCharacter] = useState<CharacterRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const generalTemplateSummary = useMemo(() => {
    return (
      characterSheetTemplatesIndex.find((template) => template.id === 'dnd-5e-charactersheet-formfillable') ??
      characterSheetTemplatesIndex.find((template) => template.className === null) ??
      null
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void characterRepository
      .getCharacter(characterId)
      .then(async (record) => {
        if (cancelled) {
          return;
        }
        if (!record) {
          setError('Character not found.');
          setCharacter(null);
          return;
        }
        const derived = await deriveCharacter(record);
        if (!cancelled) {
          setCharacter(derived.character);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load character.');
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
  }, [characterId]);

  const handleDownloadBlankSheet = useCallback(async () => {
    if (!generalTemplateSummary) {
      setError('General character sheet template is not available.');
      return;
    }
    setDownloadBusy(true);
    setError(null);
    try {
      const response = await fetch(generalTemplateSummary.pdfUrl);
      if (!response.ok) {
        throw new Error(`Failed to load template PDF: ${generalTemplateSummary.pdfUrl}`);
      }
      const blob = await response.blob();
      triggerPdfDownload(blob, GENERAL_SHEET_DOWNLOAD_FILE_NAME);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to download blank sheet.');
    } finally {
      setDownloadBusy(false);
    }
  }, [generalTemplateSummary]);

  const handleDownloadFilledSheet = useCallback(async () => {
    if (!character) {
      return;
    }
    if (!generalTemplateSummary) {
      setError('General character sheet template is not available.');
      return;
    }
    setDownloadBusy(true);
    setError(null);
    try {
      const template = await loadCharacterSheetTemplate(generalTemplateSummary.id);
      if (!template) {
        throw new Error('Failed to load general sheet template metadata.');
      }
      const values = await mapCharacterToGeneralSheetValues(character);
      const blob = await fillPdfTemplate({
        template,
        values
      });
      const fileName = buildCharacterSheetPdfFileName({
        template,
        values,
        fallbackInstanceId: character.id
      });
      triggerPdfDownload(blob, fileName);

      const now = Date.now();
      const next: CharacterRecord = {
        ...character,
        exportState: {
          ...(character.exportState ?? {}),
          generalSheetLastGeneratedAt: now
        },
        updatedAt: now
      };
      await characterRepository.saveCharacter(next);
      await characterRepository.saveAutosaveSnapshot(next.id, next);
      setCharacter(next);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to generate filled sheet.');
    } finally {
      setDownloadBusy(false);
    }
  }, [character, generalTemplateSummary]);

  const handleSaveNow = useCallback(async () => {
    if (!character) {
      return;
    }
    setSaveBusy(true);
    setError(null);
    try {
      const derived = await deriveCharacter(character);
      await characterRepository.saveCharacter(derived.character);
      await characterRepository.saveAutosaveSnapshot(derived.character.id, derived.character);
      setCharacter(derived.character);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save character.');
    } finally {
      setSaveBusy(false);
    }
  }, [character]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm text-slate-300">
        Loading review...
      </section>
    );
  }

  if (error || !character) {
    return (
      <section className="space-y-3 rounded-xl border border-rose-600/40 bg-rose-950/20 p-4 text-sm text-rose-100">
        <p>{error ?? 'Review data unavailable.'}</p>
        <button
          type="button"
          onClick={() => navigate('/player/characters')}
          className="rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-xs text-slate-100"
        >
          Back to Your Characters
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link to={`/player/characters/${character.id}`} className="text-sky-300 hover:underline">
          Back to builder
        </Link>
        <Link to="/player/characters" className="text-slate-300 hover:text-slate-100 hover:underline">
          Your Characters
        </Link>
      </div>
      <ReviewPanel
        character={character}
        onDownloadBlankSheet={() => {
          void handleDownloadBlankSheet();
        }}
        onDownloadFilledSheet={() => {
          void handleDownloadFilledSheet();
        }}
        onSaveNow={() => {
          void handleSaveNow();
        }}
        downloadBusy={downloadBusy}
        saveBusy={saveBusy}
      />
    </section>
  );
};

