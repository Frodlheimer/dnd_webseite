import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

import type {
  CharacterSheetField,
  CharacterSheetFieldType,
  CharacterSheetPage,
  CharacterSheetTemplate,
  CharacterSheetTemplateSummary
} from '../src/characterSheets/types';

type PdfWidgetAnnotation = {
  subtype?: string;
  rect?: number[];
  fieldName?: string;
  fieldType?: string;
  fieldFlags?: number;
  options?: unknown[];
  buttonValue?: unknown;
  maxLen?: number;
  multiLine?: boolean;
  radioButton?: boolean;
  checkBox?: boolean;
  pushButton?: boolean;
};

type ParsedTemplate = CharacterSheetTemplate & {
  isGeneral: boolean;
  sourcePath: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const envDirRaw = process.env.CHARACTER_SHEETS_DIR?.trim();
const envDir = envDirRaw ? path.resolve(envDirRaw) : null;
const fallbackDir = path.resolve(repoRoot, 'character_sheets');

const outputPublicDir = path.resolve(repoRoot, 'apps/web/public/character_sheets');
const outputGeneratedDir = path.resolve(repoRoot, 'apps/web/src/characterSheets/generated');
const standardFontDirectoryCandidates = [
  path.resolve(repoRoot, 'node_modules/pdfjs-dist/standard_fonts'),
  path.resolve(repoRoot, 'apps/web/node_modules/pdfjs-dist/standard_fonts')
];

const KNOWN_CLASSES = [
  'Artificer',
  'Barbarian',
  'Bard',
  'Cleric',
  'Druid',
  'Fighter',
  'Monk',
  'Paladin',
  'Ranger',
  'Rogue',
  'Sorcerer',
  'Warlock',
  'Wizard'
] as const;

const GENERAL_FILE_PATTERN = /(general|all|blank|leer|charakterbogen)/i;

const roundValue = (value: number): number => {
  return Math.round(value * 1000) / 1000;
};

const normalizeAscii = (value: string): string => {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
};

const toTitleCase = (value: string): string => {
  return value
    .split(/[\s_-]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1).toLowerCase()}`)
    .join(' ');
};

const findPdfFiles = (directoryPath: string): string[] => {
  const files: string[] = [];
  const entries = readdirSync(directoryPath, {
    withFileTypes: true
  });

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...findPdfFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      files.push(fullPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
};

const resolveStandardFontDataUrl = (): string => {
  for (const candidate of standardFontDirectoryCandidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    if (!statSync(candidate).isDirectory()) {
      continue;
    }

    const url = pathToFileURL(candidate).href;
    return url.endsWith('/') ? url : `${url}/`;
  }

  const lines: string[] = [];
  lines.push('[sheets:build] Unable to locate pdfjs-dist standard fonts directory.');
  lines.push(`Checked: ${standardFontDirectoryCandidates.join(' | ')}`);
  lines.push('Install dependencies and ensure pdfjs-dist is available in node_modules.');
  throw new Error(lines.join('\n'));
};

const standardFontDataUrl = resolveStandardFontDataUrl();

const resolveSheetsDirectory = (): string => {
  if (envDir && existsSync(envDir) && statSync(envDir).isDirectory()) {
    return envDir;
  }

  if (existsSync(fallbackDir) && statSync(fallbackDir).isDirectory()) {
    return fallbackDir;
  }

  const lines: string[] = [];
  lines.push('[sheets:build] Failed to resolve character sheets directory.');
  lines.push(`CHARACTER_SHEETS_DIR: ${envDirRaw ? envDirRaw : '(not set)'}`);
  if (envDir) {
    lines.push(`Resolved CHARACTER_SHEETS_DIR: ${envDir}`);
  }
  lines.push(`Fallback directory: ${fallbackDir}`);
  lines.push(
    'Provide CHARACTER_SHEETS_DIR or place your PDF templates in ./character_sheets at repository root.'
  );
  throw new Error(lines.join('\n'));
};

const sanitizeFilename = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  const stem = path.basename(filename, ext);
  const normalizedStem = normalizeAscii(stem);
  return `${normalizedStem || 'sheet'}.pdf`;
};

const inferClassName = (baseFilename: string): string | null => {
  const normalized = baseFilename.toLowerCase();
  for (const className of KNOWN_CLASSES) {
    if (normalized.includes(className.toLowerCase())) {
      return className;
    }
  }

  return null;
};

const inferIsGeneralTemplate = (baseFilename: string): boolean => {
  return GENERAL_FILE_PATTERN.test(baseFilename);
};

const normalizeOptions = (optionsRaw: unknown): string[] => {
  if (!Array.isArray(optionsRaw)) {
    return [];
  }

  const options: string[] = [];
  for (const entry of optionsRaw) {
    if (typeof entry === 'string') {
      const value = entry.trim();
      if (value.length > 0) {
        options.push(value);
      }
      continue;
    }

    if (Array.isArray(entry)) {
      const candidate = entry
        .map((part) => (typeof part === 'string' ? part.trim() : ''))
        .filter((part) => part.length > 0)
        .at(-1);
      if (candidate) {
        options.push(candidate);
      }
      continue;
    }

    if (entry && typeof entry === 'object') {
      const objectEntry = entry as Record<string, unknown>;
      const candidate =
        (typeof objectEntry.displayValue === 'string' && objectEntry.displayValue.trim()) ||
        (typeof objectEntry.exportValue === 'string' && objectEntry.exportValue.trim()) ||
        (typeof objectEntry.value === 'string' && objectEntry.value.trim()) ||
        '';
      if (candidate) {
        options.push(candidate);
      }
    }
  }

  return [...new Set(options)];
};

const mapFieldType = (widget: PdfWidgetAnnotation): CharacterSheetFieldType => {
  const fieldType = widget.fieldType ?? '';
  const fieldFlags = typeof widget.fieldFlags === 'number' ? widget.fieldFlags : 0;

  if (fieldType === 'Tx') {
    return 'text';
  }
  if (fieldType === 'Ch') {
    return 'dropdown';
  }
  if (fieldType === 'Sig') {
    return 'signature';
  }
  if (fieldType === 'Btn') {
    const isRadio = Boolean(widget.radioButton) || Boolean(fieldFlags & (1 << 15));
    const isPushButton = Boolean(widget.pushButton) || Boolean(fieldFlags & (1 << 16));
    if (isPushButton) {
      return 'unknown';
    }
    if (isRadio) {
      return 'radio';
    }
    return 'checkbox';
  }

  return 'unknown';
};

const extractPagesAndFields = async (pdfPath: string): Promise<{
  pages: CharacterSheetPage[];
  fields: CharacterSheetField[];
}> => {
  const bytes = readFileSync(pdfPath);
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    standardFontDataUrl,
    useWorkerFetch: false
  });
  const pdfDocument = await loadingTask.promise;

  const pages: CharacterSheetPage[] = [];
  const fields: CharacterSheetField[] = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({
      scale: 1
    });
    pages.push({
      pageIndex: pageNumber - 1,
      width: roundValue(viewport.width),
      height: roundValue(viewport.height)
    });

    const annotations = (await page.getAnnotations({
      intent: 'display'
    })) as PdfWidgetAnnotation[];

    annotations.forEach((annotation, index) => {
      if (annotation.subtype !== 'Widget') {
        return;
      }

      const rectRaw = annotation.rect ?? [];
      if (rectRaw.length !== 4) {
        return;
      }

      const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = rectRaw;
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);
      if (w <= 0 || h <= 0) {
        return;
      }

      const fieldName =
        annotation.fieldName && annotation.fieldName.trim().length > 0
          ? annotation.fieldName.trim()
          : `unnamed_${pageNumber}_${index + 1}`;
      const fieldType = mapFieldType(annotation);
      const options = normalizeOptions(annotation.options);

      const field: CharacterSheetField = {
        name: fieldName,
        type: fieldType,
        pageIndex: pageNumber - 1,
        rect: {
          x: roundValue(x),
          y: roundValue(y),
          w: roundValue(w),
          h: roundValue(h)
        }
      };

      if (options.length > 0) {
        field.options = options;
      }
      if (typeof annotation.maxLen === 'number' && Number.isFinite(annotation.maxLen)) {
        field.maxLen = annotation.maxLen;
      }

      const fieldFlags = typeof annotation.fieldFlags === 'number' ? annotation.fieldFlags : 0;
      if (annotation.multiLine || Boolean(fieldFlags & (1 << 12))) {
        field.multiline = true;
      }

      if (fieldType === 'radio' && typeof annotation.buttonValue === 'string') {
        const widgetOption = annotation.buttonValue.trim();
        if (widgetOption.length > 0) {
          field.widgetOption = widgetOption;
        }
      }

      fields.push(field);
    });
  }

  await loadingTask.destroy();

  return {
    pages,
    fields
  };
};

const createTemplateId = (filename: string, usedIds: Set<string>): string => {
  const stem = path.basename(filename, path.extname(filename));
  const baseId = normalizeAscii(stem) || 'sheet';
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }

  let suffix = 2;
  while (usedIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  const nextId = `${baseId}-${suffix}`;
  usedIds.add(nextId);
  return nextId;
};

const buildTemplateTitle = (filename: string, className: string | null, isGeneral: boolean): string => {
  if (isGeneral) {
    return 'General Character Sheet';
  }
  if (className) {
    return `${className} Character Sheet`;
  }

  const stem = path.basename(filename, path.extname(filename));
  return toTitleCase(stem);
};

const buildTemplateJsonPath = (templateId: string): string => {
  return path.resolve(outputGeneratedDir, `template_${templateId}.json`);
};

const clearGeneratedTemplateJsonFiles = (): void => {
  if (!existsSync(outputGeneratedDir)) {
    return;
  }

  const files = readdirSync(outputGeneratedDir);
  for (const file of files) {
    if (file.startsWith('template_') && file.endsWith('.json')) {
      rmSync(path.join(outputGeneratedDir, file), {
        force: true
      });
    }
  }
};

const writeGeneratedIndexFile = (templates: ParsedTemplate[]): void => {
  const sortedSummary: CharacterSheetTemplateSummary[] = templates
    .map((template) => ({
      id: template.id,
      title: template.title,
      className: template.className,
      pdfUrl: template.pdfUrl,
      pageCount: template.pageCount,
      updatedAt: template.updatedAt
    }))
    .sort((left, right) => {
      const leftIsGeneral = left.className === null && /general/i.test(left.title);
      const rightIsGeneral = right.className === null && /general/i.test(right.title);

      if (leftIsGeneral !== rightIsGeneral) {
        return leftIsGeneral ? -1 : 1;
      }

      if (left.className && right.className) {
        return left.className.localeCompare(right.className);
      }

      if (left.className && !right.className) {
        return -1;
      }
      if (!left.className && right.className) {
        return 1;
      }

      return left.title.localeCompare(right.title);
    });

  const loaderEntries = sortedSummary
    .map((summary) => {
      return `  '${summary.id}': () => import('./template_${summary.id}.json')`;
    })
    .join(',\n');

  const banner =
    '// This file is auto-generated by apps/web/scripts/build-character-sheets.ts.\n' +
    '// Do not edit manually.\n\n';

  const source =
    `${banner}` +
    "import type { CharacterSheetTemplate, CharacterSheetTemplateSummary } from '../types';\n\n" +
    `export const characterSheetTemplatesIndex: CharacterSheetTemplateSummary[] = ${JSON.stringify(
      sortedSummary,
      null,
      2
    )};\n\n` +
    `const templateLoaders: Record<string, () => Promise<unknown>> = {\n${loaderEntries}\n};\n\n` +
    'export const loadCharacterSheetTemplate = async (\n' +
    '  templateId: string\n' +
    '): Promise<CharacterSheetTemplate | null> => {\n' +
    '  const loader = templateLoaders[templateId];\n' +
    '  if (!loader) {\n' +
    '    return null;\n' +
    '  }\n\n' +
    '  const module = (await loader()) as { default: CharacterSheetTemplate };\n' +
    '  return module.default;\n' +
    '};\n';

  writeFileSync(path.resolve(outputGeneratedDir, 'templatesIndex.ts'), source, 'utf8');
};

const run = async (): Promise<void> => {
  const sourceDir = resolveSheetsDirectory();
  const pdfPaths = findPdfFiles(sourceDir);
  if (pdfPaths.length === 0) {
    throw new Error(`[sheets:build] No PDF files found in directory: ${sourceDir}`);
  }

  mkdirSync(outputPublicDir, {
    recursive: true
  });
  mkdirSync(outputGeneratedDir, {
    recursive: true
  });
  clearGeneratedTemplateJsonFiles();

  const usedTemplateIds = new Set<string>();
  const usedPublicNames = new Set<string>();
  const templates: ParsedTemplate[] = [];

  for (const pdfPath of pdfPaths) {
    const originalFilename = path.basename(pdfPath);
    const sourceStem = path.basename(originalFilename, path.extname(originalFilename));
    const isGeneral = inferIsGeneralTemplate(sourceStem);
    const className = isGeneral ? null : inferClassName(sourceStem);
    const templateId = createTemplateId(originalFilename, usedTemplateIds);
    const title = buildTemplateTitle(originalFilename, className, isGeneral);

    const basePublicFilename = sanitizeFilename(originalFilename);
    let publicFilename = basePublicFilename;
    let suffix = 2;
    while (usedPublicNames.has(publicFilename)) {
      publicFilename = basePublicFilename.replace(/\.pdf$/, `-${suffix}.pdf`);
      suffix += 1;
    }
    usedPublicNames.add(publicFilename);

    const publicPath = path.resolve(outputPublicDir, publicFilename);
    copyFileSync(pdfPath, publicPath);

    const parsed = await extractPagesAndFields(pdfPath);
    const updatedAt = statSync(pdfPath).mtime.toISOString();
    const template: ParsedTemplate = {
      id: templateId,
      title,
      className,
      pdfUrl: `/character_sheets/${publicFilename}`,
      pageCount: parsed.pages.length,
      updatedAt,
      pages: parsed.pages,
      fields: parsed.fields,
      isGeneral,
      sourcePath: pdfPath
    };

    const publicTemplate: CharacterSheetTemplate = {
      id: template.id,
      title: template.title,
      className: template.className,
      pdfUrl: template.pdfUrl,
      pageCount: template.pageCount,
      updatedAt: template.updatedAt,
      pages: template.pages,
      fields: template.fields
    };
    writeFileSync(buildTemplateJsonPath(templateId), JSON.stringify(publicTemplate, null, 2), 'utf8');
    templates.push(template);
  }

  writeGeneratedIndexFile(templates);

  console.log(`[sheets:build] Built ${templates.length} character sheet templates.`);
  console.log(`[sheets:build] Source directory: ${sourceDir}`);
  console.log(`[sheets:build] Output PDFs: ${outputPublicDir}`);
  console.log(`[sheets:build] Output metadata: ${outputGeneratedDir}`);
  for (const template of templates) {
    console.log(
      `[sheets:build] ${template.id} (${template.pageCount} pages, ${template.fields.length} fields) <- ${template.sourcePath}`
    );
  }
};

void run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
