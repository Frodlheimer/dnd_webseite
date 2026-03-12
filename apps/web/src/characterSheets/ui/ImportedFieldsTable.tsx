import { useMemo } from 'react';

import type { ImportedSheetFieldRow, ImportedSheetSection } from '../types';

type ImportedFieldsTableProps = {
  rows: ImportedSheetFieldRow[];
};

const SECTION_ORDER: ImportedSheetSection[] = [
  'Identity',
  'Core stats',
  'Combat',
  'Skills',
  'Spellcasting',
  'Features / Notes'
];

const statusLabel: Record<ImportedSheetFieldRow['status'], string> = {
  ok: 'OK',
  warning: 'Warning',
  error: 'Error'
};

const statusClasses: Record<ImportedSheetFieldRow['status'], string> = {
  ok: 'border-emerald-500/40 bg-emerald-900/25 text-emerald-200',
  warning: 'border-amber-500/40 bg-amber-900/25 text-amber-200',
  error: 'border-rose-500/40 bg-rose-900/25 text-rose-200'
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }
  if (typeof value === 'number') {
    return `${value}`;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '-';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const ImportedFieldsTable = ({ rows }: ImportedFieldsTableProps) => {
  const groupedRows = useMemo(() => {
    const groups = new Map<ImportedSheetSection, ImportedSheetFieldRow[]>();
    for (const section of SECTION_ORDER) {
      groups.set(section, []);
    }

    for (const row of rows) {
      const existing = groups.get(row.section);
      if (existing) {
        existing.push(row);
      } else {
        groups.set(row.section, [row]);
      }
    }

    return SECTION_ORDER.map((section) => ({
      section,
      rows: groups.get(section) ?? []
    })).filter((group) => group.rows.length > 0);
  }, [rows]);

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
        No parsed fields available for this import.
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-lg font-semibold tracking-tight">Parsed values</h3>
      {groupedRows.map((group) => (
        <details key={group.section} open className="rounded-lg border border-slate-700 bg-slate-950/55">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-100">
            {group.section} ({group.rows.length})
          </summary>
          <div className="overflow-auto px-3 pb-3">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-slate-300">
                  <th className="px-2 py-2 font-semibold">Field label</th>
                  <th className="px-2 py-2 font-semibold">Raw value</th>
                  <th className="px-2 py-2 font-semibold">Parsed/internal value</th>
                  <th className="px-2 py-2 font-semibold">Validation</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => {
                  const raw = formatValue(row.rawValue);
                  const parsed = formatValue(row.parsedValue);
                  return (
                    <tr key={`${row.fieldName}-${row.label}`} className="border-b border-slate-800/70 text-slate-100">
                      <td className="px-2 py-2 align-top">
                        <p className="font-medium">{row.label}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{row.fieldName}</p>
                      </td>
                      <td className="px-2 py-2 align-top text-slate-200">{raw}</td>
                      <td className="px-2 py-2 align-top text-slate-200">
                        {raw === parsed ? (
                          <span className="text-slate-400">Same as raw</span>
                        ) : (
                          <span>{parsed}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <span className={`rounded border px-2 py-0.5 font-semibold ${statusClasses[row.status]}`}>
                          {statusLabel[row.status]}
                        </span>
                        {row.issues && row.issues.length > 0 ? (
                          <p className="mt-1 text-[11px] text-slate-300">{row.issues.join(' ')}</p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </section>
  );
};
