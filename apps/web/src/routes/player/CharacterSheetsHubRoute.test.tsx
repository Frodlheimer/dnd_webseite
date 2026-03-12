import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImportedSheetRecord } from '../../characterSheets/types';

const DMS_GUILD_CLASS_SHEETS_URL =
  'https://www.dmsguild.com/en/product/232835/class-character-sheets-the-bundle';

const savedImportsStore: ImportedSheetRecord[] = [];

const mockReadPdfFields = vi.fn();
const mockLoadCharacterSheetTemplate = vi.fn();
const mockListImportedSheetRecords = vi.fn();
const mockSaveImportedSheet = vi.fn();
const mockDeleteImportedSheetRecord = vi.fn();

vi.mock('../../characterSheets/generated/templatesIndex', () => ({
  characterSheetTemplatesIndex: [
    {
      id: 'dnd-5e-charactersheet-formfillable',
      title: 'General Character Sheet',
      className: null,
      pdfUrl: '/character_sheets/dnd_5e_charactersheet_formfillable.pdf',
      pageCount: 3,
      updatedAt: '2026-03-01T00:00:00.000Z'
    },
    {
      id: 'wizard-eu-a4',
      title: 'Wizard Character Sheet',
      className: 'Wizard',
      pdfUrl: '/character_sheets/wizard-eu-a4.pdf',
      pageCount: 9,
      updatedAt: '2026-03-01T00:00:00.000Z'
    }
  ],
  loadCharacterSheetTemplate: (...args: unknown[]) => mockLoadCharacterSheetTemplate(...args)
}));

vi.mock('../../characterSheets/pdf/readPdfFields', () => ({
  readPdfFields: (...args: unknown[]) => mockReadPdfFields(...args)
}));

vi.mock('../../characterSheets/storage/characterSheetsRepository', () => ({
  characterSheetsRepository: {
    listImportedSheetRecords: (...args: unknown[]) => mockListImportedSheetRecords(...args),
    saveImportedSheet: (...args: unknown[]) => mockSaveImportedSheet(...args),
    deleteImportedSheetRecord: (...args: unknown[]) => mockDeleteImportedSheetRecord(...args)
  }
}));

import { CharacterSheetsHubRoute } from './CharacterSheetsHubRoute';

beforeEach(() => {
  savedImportsStore.length = 0;
  mockReadPdfFields.mockReset();
  mockLoadCharacterSheetTemplate.mockReset();
  mockListImportedSheetRecords.mockReset();
  mockSaveImportedSheet.mockReset();
  mockDeleteImportedSheetRecord.mockReset();

  mockLoadCharacterSheetTemplate.mockImplementation(async (templateId: string) => {
    if (templateId === 'dnd-5e-charactersheet-formfillable') {
      return {
        id: 'dnd-5e-charactersheet-formfillable',
        title: 'General Character Sheet',
        className: null,
        pdfUrl: '/character_sheets/dnd_5e_charactersheet_formfillable.pdf',
        pageCount: 3,
        updatedAt: '2026-03-01T00:00:00.000Z',
        pages: [
          {
            pageIndex: 0,
            width: 100,
            height: 100
          }
        ],
        fields: [
          {
            name: 'Character Name',
            type: 'text',
            pageIndex: 0,
            rect: {
              x: 1,
              y: 1,
              w: 10,
              h: 5
            }
          }
        ]
      };
    }

    return {
      id: 'wizard-eu-a4',
      title: 'Wizard Character Sheet',
      className: 'Wizard',
      pdfUrl: '/character_sheets/wizard-eu-a4.pdf',
      pageCount: 9,
      updatedAt: '2026-03-01T00:00:00.000Z',
      pages: [
        {
          pageIndex: 0,
          width: 100,
          height: 100
        }
      ],
      fields: [
        {
          name: 'Front_Character Name',
          type: 'text',
          pageIndex: 0,
          rect: {
            x: 1,
            y: 1,
            w: 10,
            h: 5
          }
        },
        {
          name: 'Front_AC',
          type: 'text',
          pageIndex: 0,
          rect: {
            x: 1,
            y: 1,
            w: 10,
            h: 5
          }
        },
        {
          name: 'Front_Initiative',
          type: 'text',
          pageIndex: 0,
          rect: {
            x: 1,
            y: 1,
            w: 10,
            h: 5
          }
        }
      ]
    };
  });

  mockListImportedSheetRecords.mockImplementation(async () => {
    return [...savedImportsStore].sort((left, right) => right.updatedAt - left.updatedAt);
  });

  mockSaveImportedSheet.mockImplementation(async (args: Omit<ImportedSheetRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const record: ImportedSheetRecord = {
      id: `import-${savedImportsStore.length + 1}`,
      createdAt: now,
      updatedAt: now,
      ...args
    };
    savedImportsStore.unshift(record);
    return record;
  });

  mockDeleteImportedSheetRecord.mockImplementation(async (id: string) => {
    const index = savedImportsStore.findIndex((record) => record.id === id);
    if (index >= 0) {
      savedImportsStore.splice(index, 1);
    }
  });
});

describe('CharacterSheetsHubRoute', () => {
  it('renders only the General sheet download, DMs Guild recommendation, and no preview UI', async () => {
    render(
      <MemoryRouter>
        <CharacterSheetsHubRoute />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'General Character Sheet' })).toBeInTheDocument();
    expect(screen.queryByText('Wizard Character Sheet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download blank PDF' })).toBeInTheDocument();

    const recommendationLink = screen.getByRole('link', {
      name: 'Open class-specific bundle on DMs Guild'
    });
    expect(recommendationLink).toHaveAttribute('href', DMS_GUILD_CLASS_SHEETS_URL);
    expect(recommendationLink).toHaveAttribute('target', '_blank');
    expect(recommendationLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(recommendationLink).toHaveAttribute('rel', expect.stringContaining('noreferrer'));

    await waitFor(() => {
      expect(screen.queryByText('Loading saved imports...')).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/Show PDF background/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Create from template/i)).not.toBeInTheDocument();
  });

  it('imports a filled PDF, renders parsed values + validation summary, and stores result locally', async () => {
    mockReadPdfFields.mockResolvedValue({
      fieldNames: ['Front_Character Name', 'Front_AC', 'Front_Initiative'],
      values: {
        'Front_Character Name': 'Elara',
        Front_AC: '17',
        Front_Initiative: 'abc'
      }
    });

    render(
      <MemoryRouter>
        <CharacterSheetsHubRoute />
      </MemoryRouter>
    );

    const fileInput = screen.getAllByLabelText('Upload filled character sheet PDF')[0];
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error('Upload file input is unavailable');
    }
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['dummy-pdf-content'], 'wizard-filled.pdf', { type: 'application/pdf' })]
      }
    });

    await waitFor(() => {
      expect(mockSaveImportedSheet).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Imported sheet result')).toBeInTheDocument();
    expect(screen.getAllByText('wizard-filled.pdf').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/warnings \|/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Parsed values')).toBeInTheDocument();
    expect(screen.getByText('Character Name')).toBeInTheDocument();
  });
});
