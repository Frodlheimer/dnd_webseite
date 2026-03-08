import type { SrdContentBlock } from '../types';

const headingClassByType: Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', string> = {
  h1: 'text-2xl font-semibold tracking-tight text-slate-50',
  h2: 'text-xl font-semibold tracking-tight text-slate-100',
  h3: 'text-lg font-semibold tracking-tight text-slate-100',
  h4: 'text-base font-semibold tracking-tight text-slate-100',
  h5: 'text-sm font-semibold tracking-tight text-slate-100',
  h6: 'text-sm font-semibold tracking-tight text-slate-100/90'
};

export const SrdDocumentBlocks = ({ blocks }: { blocks: SrdContentBlock[] }) => {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-200">
      {blocks.map((block, index) => {
        const key = `srd-block-${index}`;
        if (block.type === 'p') {
          return (
            <p key={key} className="text-[0.98rem] leading-7 text-slate-200">
              {block.text}
            </p>
          );
        }

        if (
          block.type === 'h1' ||
          block.type === 'h2' ||
          block.type === 'h3' ||
          block.type === 'h4' ||
          block.type === 'h5' ||
          block.type === 'h6'
        ) {
          const HeadingTag = block.type;
          return (
            <HeadingTag key={key} className={headingClassByType[block.type]}>
              {block.text}
            </HeadingTag>
          );
        }

        if (block.type === 'ul' || block.type === 'ol') {
          const ListTag = block.type;
          const listClass =
            block.type === 'ul'
              ? 'ml-6 list-outside list-disc space-y-2 text-[0.98rem] leading-7 text-slate-200 marker:text-sky-300'
              : 'ml-6 list-outside list-decimal space-y-2 text-[0.98rem] leading-7 text-slate-200 marker:text-slate-400';
          return (
            <ListTag key={key} className={listClass}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-item-${itemIndex}`} className="pl-1">
                  {item}
                </li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'pre') {
          return (
            <pre
              key={key}
              className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200"
            >
              {block.lines.map((line, lineIndex) => (
                <span key={`${key}-line-${lineIndex}`}>
                  {line}
                  {lineIndex < block.lines.length - 1 ? <br /> : null}
                </span>
              ))}
            </pre>
          );
        }

        if (block.type === 'table') {
          return (
            <div key={key} className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/45">
              <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr
                      key={`${key}-row-${rowIndex}`}
                      className="border-b border-slate-800 last:border-b-0"
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${key}-row-${rowIndex}-cell-${cellIndex}`}
                          className={`px-3 py-2 align-top ${
                            rowIndex === 0 ? 'font-semibold text-slate-100' : 'text-slate-200'
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return <hr key={key} className="border-slate-700" />;
      })}
    </div>
  );
};
