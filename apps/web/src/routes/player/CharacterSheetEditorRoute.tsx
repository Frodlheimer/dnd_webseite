import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  buildCharacterSheetPdfFileName,
  fillPdfTemplate,
  triggerPdfDownload
} from '../../characterSheets/pdf/fillPdf';
import { readPdfFields } from '../../characterSheets/pdf/readPdfFields';
import {
  characterSheetTemplatesIndex,
  loadCharacterSheetTemplate
} from '../../characterSheets/generated/templatesIndex';
import { characterSheetsRepository } from '../../characterSheets/storage/characterSheetsRepository';
import { CharacterSheetEditor } from '../../characterSheets/ui/CharacterSheetEditor';
import type {
  CharacterSheetInstance,
  CharacterSheetTemplate,
  CharacterSheetValues
} from '../../characterSheets/types';

const buildDefaultTitle = (templateTitle: string): string => {
  return `${templateTitle} ${new Date().toLocaleDateString()}`;
};

export const CharacterSheetEditorRoute = () => {
  const params = useParams<{ templateId: string }>();
  const templateId = params.templateId ?? '';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<CharacterSheetTemplate | null>(null);
  const [instance, setInstance] = useState<CharacterSheetInstance | null>(null);
  const [values, setValues] = useState<CharacterSheetValues>({});
  const [saveTick, setSaveTick] = useState(0);
  const [titleTick, setTitleTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const searchParamsString = searchParams.toString();

  const templateSummary = useMemo(() => {
    return characterSheetTemplatesIndex.find((entry) => entry.id === templateId) ?? null;
  }, [templateId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      if (!templateId) {
        throw new Error('Template ID is missing.');
      }

      const loadedTemplate = await loadCharacterSheetTemplate(templateId);
      if (!loadedTemplate) {
        throw new Error(`Template not found: ${templateId}`);
      }

      const currentSearchParams = new URLSearchParams(searchParamsString);
      const requestedInstanceId = currentSearchParams.get('instance');
      let loadedInstance: CharacterSheetInstance | null = null;
      if (requestedInstanceId) {
        loadedInstance = await characterSheetsRepository.getInstance(requestedInstanceId);
      }

      if (!loadedInstance || loadedInstance.templateId !== loadedTemplate.id) {
        loadedInstance = await characterSheetsRepository.createInstance({
          templateId: loadedTemplate.id,
          title: buildDefaultTitle(loadedTemplate.title)
        });

        const nextSearchParams = new URLSearchParams(currentSearchParams);
        nextSearchParams.set('instance', loadedInstance.instanceId);
        navigate(`/player/characters/sheets/${loadedTemplate.id}?${nextSearchParams.toString()}`, {
          replace: true
        });
      }

      if (cancelled) {
        return;
      }

      setTemplate(loadedTemplate);
      setInstance(loadedInstance);
      setValues(loadedInstance.values ?? {});
      setLastSavedAt(loadedInstance.updatedAt);
      setLoading(false);
    };

    void run().catch((loadError) => {
      if (cancelled) {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Failed to load sheet editor');
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [navigate, searchParamsString, templateId]);

  useEffect(() => {
    if (!instance || saveTick <= 0) {
      return;
    }

    let cancelled = false;
    setSaving(true);
    const timeout = window.setTimeout(() => {
      void characterSheetsRepository
        .saveValues(instance.instanceId, values)
        .then((updated) => {
          if (cancelled) {
            return;
          }
          setInstance(updated);
          setLastSavedAt(updated.updatedAt);
        })
        .catch((saveError) => {
          if (!cancelled) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save sheet values');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSaving(false);
          }
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [instance, saveTick, values]);

  useEffect(() => {
    if (!instance || titleTick <= 0) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void characterSheetsRepository
        .updateTitle(instance.instanceId, instance.title)
        .then((updated) => {
          if (!cancelled) {
            setInstance(updated);
            setLastSavedAt(updated.updatedAt);
          }
        })
        .catch((saveError) => {
          if (!cancelled) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save title');
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [instance, titleTick]);

  const handleDownload = async () => {
    if (!template || !instance) {
      return;
    }

    const blob = await fillPdfTemplate({
      template,
      values
    });
    const fileName = buildCharacterSheetPdfFileName({
      template,
      values,
      fallbackInstanceId: instance.instanceId
    });
    triggerPdfDownload(blob, fileName);
  };

  const handleImportPdf = async (file: File) => {
    const parsed = await readPdfFields(file);
    setValues(parsed.values);
    setSaveTick((previous) => previous + 1);
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
        Loading character sheet editor...
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
        <Link
          to="/player/characters/sheets"
          className="mt-3 inline-flex rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          Back to templates
        </Link>
      </section>
    );
  }

  if (!template || !instance) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
        Editor state is unavailable.
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <Link to="/player/characters/sheets" className="hover:text-sky-300 hover:underline">
          Character Sheets
        </Link>
        <span>/</span>
        <span className="text-slate-200">{templateSummary?.title ?? template.title}</span>
      </nav>

      <CharacterSheetEditor
        template={template}
        instance={instance}
        values={values}
        saving={saving}
        lastSavedAt={lastSavedAt}
        onTitleChange={(nextTitle) => {
          setInstance((previous) => {
            if (!previous) {
              return previous;
            }

            return {
              ...previous,
              title: nextTitle
            };
          });
          setTitleTick((previous) => previous + 1);
        }}
        onValuesChange={(nextValues) => {
          setValues(nextValues);
          setSaveTick((previous) => previous + 1);
        }}
        onDownloadPdf={handleDownload}
        onImportPdf={handleImportPdf}
      />
    </div>
  );
};
