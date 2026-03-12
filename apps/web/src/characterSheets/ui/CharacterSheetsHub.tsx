import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { readPdfFields } from '../pdf/readPdfFields';
import { triggerPdfDownload } from '../pdf/fillPdf';
import { characterSheetsRepository } from '../storage/characterSheetsRepository';
import { pickBestTemplateMatch } from '../templateMatching';
import type { ImportedSheetRecord } from '../types';
import {
  characterSheetTemplatesIndex,
  loadCharacterSheetTemplate
} from '../generated/templatesIndex';
import {
  buildExtractedFieldsFromValues,
  buildParsedCharacterData,
  validateImportedSheet
} from '../validation/validateImportedSheet';
import { GeneralSheetDownloadCard } from './GeneralSheetDownloadCard';
import { ImportedFieldsTable } from './ImportedFieldsTable';
import { ImportedSheetSummary } from './ImportedSheetSummary';
import { ImportedSheetsList } from './ImportedSheetsList';
import { RecommendedSheetsNotice } from './RecommendedSheetsNotice';
import { SheetUploadCard } from './SheetUploadCard';

const GENERAL_SHEET_DOWNLOAD_FILE_NAME = 'general-character-sheet-blank.pdf';

const deriveImportStatus = (errors: number, warnings: number): ImportedSheetRecord['importStatus'] => {
  if (errors > 0) {
    return 'error';
  }
  if (warnings > 0) {
    return 'warning';
  }
  return 'ok';
};

export const CharacterSheetsHub = () => {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedImports, setSavedImports] = useState<ImportedSheetRecord[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [loadingSavedImports, setLoadingSavedImports] = useState(true);

  const generalTemplate = useMemo(() => {
    const byExpectedFilename = characterSheetTemplatesIndex.find(
      (template) =>
        template.className === null &&
        /dnd[_-]5e[_-]charactersheet[_-]formfillable\.pdf$/i.test(template.pdfUrl)
    );
    if (byExpectedFilename) {
      return byExpectedFilename;
    }

    const byGeneralTitle = characterSheetTemplatesIndex.find(
      (template) =>
        template.className === null &&
        /general character sheet/i.test(template.title) &&
        !/[_-]de\.pdf$/i.test(template.pdfUrl)
    );
    if (byGeneralTitle) {
      return byGeneralTitle;
    }

    return characterSheetTemplatesIndex.find((template) => template.className === null) ?? null;
  }, []);

  const selectedImport = useMemo(() => {
    return savedImports.find((record) => record.id === selectedImportId) ?? null;
  }, [savedImports, selectedImportId]);

  const loadSavedImports = useCallback(async (preferredImportId?: string) => {
    const records = await characterSheetsRepository.listImportedSheetRecords(25);
    setSavedImports(records);
    setSelectedImportId((previousSelectedId) => {
      if (preferredImportId && records.some((record) => record.id === preferredImportId)) {
        return preferredImportId;
      }

      if (previousSelectedId && records.some((record) => record.id === previousSelectedId)) {
        return previousSelectedId;
      }

      return records[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingSavedImports(true);
    void loadSavedImports()
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load saved imports');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSavedImports(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadSavedImports]);

  const handleDownloadGeneralSheet = useCallback(async () => {
    if (!generalTemplate) {
      setError('General character sheet template is not available.');
      return;
    }

    setDownloadBusy(true);
    setError(null);
    try {
      const response = await fetch(generalTemplate.pdfUrl);
      if (!response.ok) {
        throw new Error(`Failed to load PDF template: ${generalTemplate.pdfUrl}`);
      }
      const pdfBlob = await response.blob();
      triggerPdfDownload(pdfBlob, GENERAL_SHEET_DOWNLOAD_FILE_NAME);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to download general sheet');
    } finally {
      setDownloadBusy(false);
    }
  }, [generalTemplate]);

  const handleImport = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        const parsedPdf = await readPdfFields(file);
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
          uploadedFieldNames: parsedPdf.fieldNames,
          templates: templatesWithFieldNames
        });
        if (!match) {
          throw new Error('Could not match this PDF to a supported character sheet template.');
        }

        const matchedTemplate = characterSheetTemplatesIndex.find((entry) => entry.id === match.templateId) ?? null;
        const extractedFields = buildExtractedFieldsFromValues(parsedPdf.values);
        const initialParsedData = buildParsedCharacterData(extractedFields);
        const validation = validateImportedSheet(initialParsedData, extractedFields);
        const importStatus = deriveImportStatus(validation.errors.length, validation.warnings.length);

        const savedRecord = await characterSheetsRepository.saveImportedSheet({
          sourceFileName: file.name,
          templateId: matchedTemplate?.id ?? null,
          templateTitle: matchedTemplate?.title ?? null,
          importStatus,
          validationSummary: {
            errors: validation.errors.length,
            warnings: validation.warnings.length
          },
          parsedData: validation.normalizedData,
          extractedFields: validation.extractedRows
        });

        await loadSavedImports(savedRecord.id);
      } finally {
        setBusy(false);
      }
    },
    [loadSavedImports]
  );

  const onImportInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void handleImport(file).catch((importError) => {
      setError(importError instanceof Error ? importError.message : 'Failed to import character sheet');
    });

    event.target.value = '';
  };

  const handleDeleteImport = useCallback(
    async (importId: string) => {
      try {
        await characterSheetsRepository.deleteImportedSheetRecord(importId);
        await loadSavedImports();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete imported sheet');
      }
    },
    [loadSavedImports]
  );

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-800 bg-slate-900/65 p-5">
        <h2 className="text-2xl font-semibold tracking-tight">Character Sheets</h2>
        <p className="mt-2 text-sm text-slate-300">
          Download the blank general sheet, import filled sheets, and inspect parsed values with validation.
          Everything runs locally in your browser.
        </p>
      </header>

      <GeneralSheetDownloadCard
        template={generalTemplate}
        downloading={downloadBusy}
        onDownload={handleDownloadGeneralSheet}
      />

      <RecommendedSheetsNotice />

      <SheetUploadCard
        busy={busy}
        error={error}
        importInputRef={importInputRef}
        onOpenFilePicker={() => importInputRef.current?.click()}
        onFileChange={onImportInputChange}
      />

      {loadingSavedImports ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          Loading saved imports...
        </section>
      ) : (
        <div className="space-y-4">
          <ImportedSheetsList
            imports={savedImports}
            selectedImportId={selectedImportId}
            onSelectImport={setSelectedImportId}
            onDeleteImport={(importId) => {
              void handleDeleteImport(importId);
            }}
          />
          <ImportedSheetSummary record={selectedImport} />
          <ImportedFieldsTable rows={selectedImport?.extractedFields ?? []} />
        </div>
      )}
    </section>
  );
};
