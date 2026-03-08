import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..', '..');

const candidateSourceDirs = [
  path.resolve(webRoot, 'node_modules/pdfjs-dist/standard_fonts'),
  path.resolve(repoRoot, 'node_modules/pdfjs-dist/standard_fonts')
];

const destinationDir = path.resolve(webRoot, 'public/standard_fonts');

const ensureDirectory = (directoryPath: string): void => {
  mkdirSync(directoryPath, {
    recursive: true
  });
};

const findSourceDir = (): string => {
  for (const candidate of candidateSourceDirs) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const lines: string[] = [];
  lines.push('[pdfjs:assets] Unable to locate pdfjs-dist standard font assets.');
  lines.push(`Checked: ${candidateSourceDirs.join(' | ')}`);
  lines.push('Install dependencies and ensure pdfjs-dist is available in node_modules.');
  throw new Error(lines.join('\n'));
};

const shouldCopyFile = (sourcePath: string, destinationPath: string): boolean => {
  if (!existsSync(destinationPath)) {
    return true;
  }

  const sourceStats = statSync(sourcePath);
  const destinationStats = statSync(destinationPath);
  if (sourceStats.size !== destinationStats.size) {
    return true;
  }

  return sourceStats.mtimeMs > destinationStats.mtimeMs;
};

const copyRecursive = (
  sourceDirectory: string,
  destinationDirectory: string
): { copied: number; skipped: number } => {
  ensureDirectory(destinationDirectory);

  let copied = 0;
  let skipped = 0;

  const entries = readdirSync(sourceDirectory, {
    withFileTypes: true
  });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const destinationPath = path.join(destinationDirectory, entry.name);

    if (entry.isDirectory()) {
      const nested = copyRecursive(sourcePath, destinationPath);
      copied += nested.copied;
      skipped += nested.skipped;
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (shouldCopyFile(sourcePath, destinationPath)) {
      ensureDirectory(path.dirname(destinationPath));
      copyFileSync(sourcePath, destinationPath);
      copied += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    copied,
    skipped
  };
};

const run = (): void => {
  const sourceDir = findSourceDir();
  ensureDirectory(destinationDir);
  const result = copyRecursive(sourceDir, destinationDir);

  console.log(`[pdfjs:assets] Source: ${sourceDir}`);
  console.log(`[pdfjs:assets] Destination: ${destinationDir}`);
  console.log(`[pdfjs:assets] Copied files: ${result.copied}`);
  console.log(`[pdfjs:assets] Skipped files: ${result.skipped}`);
};

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
