import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { readPdfFields } from '../../characterSheets/pdf/readPdfFields';
import { characterSheetsRepository } from '../../characterSheets/storage/characterSheetsRepository';
import { pickBestTemplateMatch } from '../../characterSheets/templateMatching';
import {
  characterSheetTemplatesIndex,
  loadCharacterSheetTemplate
} from '../../characterSheets/generated/templatesIndex';
import type { CharacterSheetTemplateSummary } from '../../characterSheets/types';

const TemplateCard = ({
  template,
  onCreate
}: {
  template: CharacterSheetTemplateSummary;
  onCreate: (template: CharacterSheetTemplateSummary) => void;
}) => {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-lg font-semibold tracking-tight text-slate-100">{template.title}</h3>
      <p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-400">
        {template.className ? `Class: ${template.className}` : 'General'}
      </p>
      <p className="mt-2 text-sm text-slate-300">{template.pageCount} pages</p>
      <button
        type="button"
        onClick={() => onCreate(template)}
        className="mt-4 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
      >
        Create from template
      </button>
    </article>
  );
};

export const CharacterSheetsHubRoute = () => {
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createInstance = async (template: CharacterSheetTemplateSummary, values?: Record<string, string | boolean>) => {
    const now = new Date();
    const createArgs: {
      templateId: string;
      title: string;
      values?: Record<string, string | boolean>;
    } = {
      templateId: template.id,
      title: `${template.title} ${now.toLocaleDateString()}`
    };
    if (values) {
      createArgs.values = values;
    }

    const instance = await characterSheetsRepository.createInstance(createArgs);

    const params = new URLSearchParams();
    params.set('instance', instance.instanceId);
    navigate(`/player/characters/sheets/${template.id}?${params.toString()}`);
  };

  const handleImport = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const parsed = await readPdfFields(file);
      const templatesWithFieldNames = await Promise.all(
        characterSheetTemplatesIndex.map(async (summary) => {
          const detail = await loadCharacterSheetTemplate(summary.id);
          return {
            summary,
            fieldNames: detail ? detail.fields.map((field) => field.name) : []
          };
        })
      );

      const match = pickBestTemplateMatch({
        uploadedFieldNames: parsed.fieldNames,
        templates: templatesWithFieldNames
      });
      if (!match) {
        throw new Error('Could not match this PDF to a built-in sheet template.');
      }

      const template = characterSheetTemplatesIndex.find((entry) => entry.id === match.templateId);
      if (!template) {
        throw new Error(`Matched template is not available: ${match.templateId}`);
      }

      await createInstance(template, parsed.values);
    } finally {
      setBusy(false);
    }
  };

  const onImportInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void handleImport(file).catch((importError) => {
      setError(importError instanceof Error ? importError.message : 'Failed to import sheet');
    });

    event.target.value = '';
  };

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-800 bg-slate-900/65 p-5">
        <h2 className="text-2xl font-semibold tracking-tight">Character Sheets</h2>
        <p className="mt-2 text-sm text-slate-300">
          Pick a built-in PDF template, fill it in-browser, and download or import filled sheets.
          Everything runs client-side.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-sky-500/70"
            disabled={busy}
          >
            {busy ? 'Importing...' : 'Import filled PDF'}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={onImportInputChange}
          />
        </div>

        {error ? (
          <p className="mt-3 rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {characterSheetTemplatesIndex.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onCreate={(nextTemplate) => {
              void createInstance(nextTemplate).catch((createError) => {
                setError(createError instanceof Error ? createError.message : 'Failed to create sheet');
              });
            }}
          />
        ))}
      </div>
    </section>
  );
};
