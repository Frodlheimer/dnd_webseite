import type { SpellDescriptionBlock } from '../types';
import { renderSpellTextWithLinks } from './spellTextLinks';

type SpellDescriptionBlocksProps = {
  blocks: SpellDescriptionBlock[];
  keyPrefix: string;
  currentSlug: string;
  linkState?: unknown;
};

export const SpellDescriptionBlocks = ({
  blocks,
  keyPrefix,
  currentSlug,
  linkState
}: SpellDescriptionBlocksProps) => {
  return (
    <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-200">
      {blocks.map((block, index) => {
        if (block.type === 'table') {
          return (
            <section
              key={`${keyPrefix}-table-${index}`}
              className="rounded-lg border border-slate-700 bg-slate-950/60"
            >
              <h4 className="border-b border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100">
                {block.title}
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-sm text-slate-200">
                  <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                    <tr>
                      {block.columns.map((column) => (
                        <th key={`${keyPrefix}-col-${index}-${column}`} className="px-3 py-2">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`${keyPrefix}-row-${index}-${rowIndex}`} className="align-top">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${keyPrefix}-cell-${index}-${rowIndex}-${cellIndex}`}
                            className="px-3 py-2"
                          >
                            {renderSpellTextWithLinks(cell, {
                              currentSlug,
                              linkState
                            })}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        }

        if (block.type === 'list') {
          return (
            <section
              key={`${keyPrefix}-list-${index}`}
              className="rounded-lg border border-slate-700 bg-slate-950/60"
            >
              <h4 className="border-b border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100">
                {block.title}
              </h4>
              <ul className="list-disc space-y-2 px-8 py-3 text-sm text-slate-200 marker:text-slate-400">
                {block.items.map((item, itemIndex) => (
                  <li key={`${keyPrefix}-list-item-${index}-${itemIndex}`}>
                    {renderSpellTextWithLinks(item, {
                      currentSlug,
                      linkState
                    })}
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        return (
          <p key={`${keyPrefix}-paragraph-${index}`}>
            {renderSpellTextWithLinks(block.text, {
              currentSlug,
              linkState
            })}
          </p>
        );
      })}
    </div>
  );
};
