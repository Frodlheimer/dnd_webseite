import { useMemo, useState, type ChangeEvent } from 'react';

import type {
  CharacterSheetField,
  CharacterSheetInstance,
  CharacterSheetTemplate,
  CharacterSheetValues
} from '../types';
import { PdfPageBackground } from './PdfPageBackground';

type CharacterSheetEditorProps = {
  template: CharacterSheetTemplate;
  instance: CharacterSheetInstance;
  values: CharacterSheetValues;
  saving: boolean;
  lastSavedAt: string | null;
  onTitleChange: (title: string) => void;
  onValuesChange: (values: CharacterSheetValues) => void;
  onDownloadPdf: () => Promise<void>;
  onImportPdf: (file: File) => Promise<void>;
};

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const buildFieldKey = (field: CharacterSheetField): string => {
  return `${field.name}-${field.pageIndex}-${field.rect.x}-${field.rect.y}-${field.rect.w}-${field.rect.h}-${field.widgetOption ?? ''}`;
};

const toTopOffset = (field: CharacterSheetField, pageHeight: number): number => {
  return pageHeight - (field.rect.y + field.rect.h);
};

const sortedFields = (fields: CharacterSheetField[]): CharacterSheetField[] => {
  return [...fields].sort((left, right) => {
    if (left.pageIndex !== right.pageIndex) {
      return left.pageIndex - right.pageIndex;
    }
    if (left.rect.y !== right.rect.y) {
      return right.rect.y - left.rect.y;
    }
    return left.rect.x - right.rect.x;
  });
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const renderFieldLabel = (field: CharacterSheetField): string => {
  if (field.type === 'radio' && field.widgetOption) {
    return `${field.name} (${field.widgetOption})`;
  }
  return field.name;
};

export const CharacterSheetEditor = ({
  template,
  instance,
  values,
  saving,
  lastSavedAt,
  onTitleChange,
  onValuesChange,
  onDownloadPdf,
  onImportPdf
}: CharacterSheetEditorProps) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [showPdfBackground, setShowPdfBackground] = useState(false);
  const [showFieldNames, setShowFieldNames] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const page = template.pages[pageIndex];
  const zoom = ZOOM_STEPS[zoomIndex] ?? 1;
  const displayWidth = page ? roundValue(page.width * zoom) : 0;
  const displayHeight = page ? roundValue(page.height * zoom) : 0;
  const scale = page && page.width > 0 ? displayWidth / page.width : 1;

  const tabOrderFields = useMemo(() => sortedFields(template.fields), [template.fields]);
  const tabIndexByFieldKey = useMemo(() => {
    const map = new Map<string, number>();
    tabOrderFields.forEach((field, index) => {
      map.set(buildFieldKey(field), index + 1);
    });
    return map;
  }, [tabOrderFields]);

  const currentPageFields = useMemo(() => {
    return tabOrderFields.filter((field) => field.pageIndex === pageIndex);
  }, [pageIndex, tabOrderFields]);

  const currentPageFieldEntries = useMemo(() => {
    return currentPageFields.map((field) => ({
      field,
      key: buildFieldKey(field),
      tabIndex: tabIndexByFieldKey.get(buildFieldKey(field)) ?? 1
    }));
  }, [currentPageFields, tabIndexByFieldKey]);

  const setValue = (fieldName: string, nextValue: string | boolean) => {
    onValuesChange({
      ...values,
      [fieldName]: nextValue
    });
  };

  const handleUploadFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setErrorMessage(null);
    setBusyMessage('Importing PDF...');
    try {
      await onImportPdf(file);
      setBusyMessage(null);
    } catch (error) {
      setBusyMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to import PDF');
    } finally {
      event.target.value = '';
    }
  };

  const handleDownload = async () => {
    setErrorMessage(null);
    setBusyMessage('Generating PDF...');
    try {
      await onDownloadPdf();
      setBusyMessage(null);
    } catch (error) {
      setBusyMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to download PDF');
    }
  };

  if (!page) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
        No pages found in this template.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Character Sheets</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{template.title}</h2>
            <p className="mt-1 text-xs text-slate-400">
              Template ID: {template.id} | Fields: {template.fields.length}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-sky-500/70"
          >
            Download PDF
          </button>
          <label className="cursor-pointer rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-sky-500/70">
            Upload filled PDF
            <input type="file" accept="application/pdf" className="hidden" onChange={handleUploadFileInput} />
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="text-sm text-slate-200">
            Sheet title
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
              value={instance.title}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </label>

          <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.17em] text-slate-400">Page</p>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-slate-600 px-2 py-1 text-xs disabled:opacity-40"
                disabled={pageIndex <= 0}
                onClick={() => setPageIndex((previous) => Math.max(0, previous - 1))}
              >
                Prev
              </button>
              <span className="text-xs text-slate-300">
                {pageIndex + 1} / {template.pageCount}
              </span>
              <button
                type="button"
                className="rounded border border-slate-600 px-2 py-1 text-xs disabled:opacity-40"
                disabled={pageIndex + 1 >= template.pageCount}
                onClick={() =>
                  setPageIndex((previous) => Math.min(template.pageCount - 1, previous + 1))
                }
              >
                Next
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.17em] text-slate-400">Zoom</p>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-slate-600 px-2 py-1 text-xs disabled:opacity-40"
                disabled={zoomIndex <= 0}
                onClick={() => setZoomIndex((previous) => clamp(previous - 1, 0, ZOOM_STEPS.length - 1))}
              >
                -
              </button>
              <span className="text-xs text-slate-300">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="rounded border border-slate-600 px-2 py-1 text-xs disabled:opacity-40"
                disabled={zoomIndex >= ZOOM_STEPS.length - 1}
                onClick={() => setZoomIndex((previous) => clamp(previous + 1, 0, ZOOM_STEPS.length - 1))}
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showPdfBackground}
                onChange={(event) => setShowPdfBackground(event.target.checked)}
              />
              Show PDF background
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showFieldNames}
                onChange={(event) => setShowFieldNames(event.target.checked)}
              />
              Show field names
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>{saving ? 'Saving...' : 'Saved locally'}</span>
          {lastSavedAt ? <span>Last save: {new Date(lastSavedAt).toLocaleTimeString()}</span> : null}
          {busyMessage ? <span className="text-sky-300">{busyMessage}</span> : null}
          {errorMessage ? <span className="text-rose-300">{errorMessage}</span> : null}
        </div>
      </header>

      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="overflow-auto">
          <div
            className="relative mx-auto border border-slate-600 bg-white shadow-2xl"
            style={{
              width: `${displayWidth}px`,
              height: `${displayHeight}px`
            }}
          >
            <PdfPageBackground
              enabled={showPdfBackground}
              pdfUrl={template.pdfUrl}
              pageNumber={pageIndex + 1}
              width={displayWidth}
              height={displayHeight}
              scale={scale}
            />

            <div className="absolute inset-0 z-[3]">
              {currentPageFieldEntries.map(({ field, key, tabIndex }) => {
                const top = toTopOffset(field, page.height) * scale;
                const left = field.rect.x * scale;
                const width = field.rect.w * scale;
                const height = field.rect.h * scale;
                const nameLabel = renderFieldLabel(field);
                const value = values[field.name];
                const fontSize = clamp(height * 0.52, 10, 16);
                const showLabel = showFieldNames || activeField === key;
                const inputBaseClass =
                  'h-full w-full rounded-[2px] border border-sky-600/50 bg-sky-50/35 px-1 text-[11px] text-slate-900 outline-none focus:border-sky-600 focus:bg-sky-100/70';

                return (
                  <div
                    key={key}
                    className="absolute"
                    style={{
                      top: `${top}px`,
                      left: `${left}px`,
                      width: `${width}px`,
                      height: `${height}px`
                    }}
                    onMouseEnter={() => setActiveField(key)}
                    onMouseLeave={() => setActiveField((previous) => (previous === key ? null : previous))}
                  >
                    {showLabel ? (
                      <div className="pointer-events-none absolute -top-5 left-0 z-[5] rounded bg-slate-900/90 px-1 py-0.5 text-[10px] text-slate-100">
                        {nameLabel}
                      </div>
                    ) : null}

                    {field.type === 'checkbox' ? (
                      <label className="flex h-full w-full items-center justify-center rounded-[2px] border border-sky-600/55 bg-sky-50/30">
                        <input
                          type="checkbox"
                          tabIndex={tabIndex}
                          checked={value === true}
                          onChange={(event) => setValue(field.name, event.target.checked)}
                          className="h-3 w-3"
                        />
                      </label>
                    ) : null}

                    {field.type === 'radio' ? (
                      <label className="flex h-full w-full items-center justify-center rounded-[2px] border border-sky-600/55 bg-sky-50/30">
                        <input
                          type="radio"
                          tabIndex={tabIndex}
                          name={`radio-${field.name}`}
                          checked={String(value ?? '') === (field.widgetOption ?? key)}
                          onChange={() => setValue(field.name, field.widgetOption ?? key)}
                          className="h-3 w-3"
                        />
                      </label>
                    ) : null}

                    {field.type === 'dropdown' ? (
                      <select
                        tabIndex={tabIndex}
                        value={typeof value === 'string' ? value : ''}
                        onChange={(event) => setValue(field.name, event.target.value)}
                        className={inputBaseClass}
                        style={{ fontSize: `${fontSize}px` }}
                      >
                        <option value=""> </option>
                        {(field.options ?? []).map((option) => (
                          <option key={`${field.name}-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : null}

                    {field.type !== 'checkbox' && field.type !== 'radio' && field.type !== 'dropdown' ? (
                      field.multiline || height > 30 ? (
                        <textarea
                          tabIndex={tabIndex}
                          value={typeof value === 'string' ? value : ''}
                          onChange={(event) => setValue(field.name, event.target.value)}
                          maxLength={field.maxLen}
                          className={`${inputBaseClass} resize-none leading-tight`}
                          style={{ fontSize: `${fontSize}px` }}
                        />
                      ) : (
                        <input
                          tabIndex={tabIndex}
                          type="text"
                          value={typeof value === 'string' ? value : ''}
                          onChange={(event) => setValue(field.name, event.target.value)}
                          maxLength={field.maxLen}
                          className={inputBaseClass}
                          style={{ fontSize: `${fontSize}px` }}
                        />
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const roundValue = (value: number): number => {
  return Math.round(value * 1000) / 1000;
};
