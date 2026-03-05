import type { RulesDocumentBlock } from '../types';

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatInlineMarkers = (value: string): string => {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/\[B\]/gi, '<strong>')
    .replace(/\[\/B\]/gi, '</strong>')
    .replace(/\[I\]/gi, '<em>')
    .replace(/\[\/I\]/gi, '</em>')
    .replace(/\[CODE\]/gi, '<code>')
    .replace(/\[\/CODE\]/gi, '</code>')
    .replace(/\[SUP\]/gi, '<sup>')
    .replace(/\[\/SUP\]/gi, '</sup>')
    .replace(/\[SUB\]/gi, '<sub>')
    .replace(/\[\/SUB\]/gi, '</sub>');
};

const InlineText = ({ text }: { text: string }) => {
  return <span dangerouslySetInnerHTML={{ __html: formatInlineMarkers(text) }} />;
};

export const ClassDocumentBlocks = ({ blocks }: { blocks: RulesDocumentBlock[] }) => {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-200">
      {blocks.map((block, index) => {
        const key = `block-${index}`;

        if (block.type === 'p') {
          return (
            <p key={key}>
              <InlineText text={block.text} />
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
            <HeadingTag key={key} className="text-lg font-semibold tracking-tight text-slate-100">
              <InlineText text={block.text} />
            </HeadingTag>
          );
        }

        if (block.type === 'ul' || block.type === 'ol') {
          const ListTag = block.type;
          return (
            <ListTag key={key} className="ml-6 list-outside space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-item-${itemIndex}`}>
                  <InlineText text={item} />
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
              {block.lines.join('\n')}
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
                            rowIndex === 0
                              ? 'font-semibold text-slate-100'
                              : 'text-slate-200'
                          }`}
                        >
                          <InlineText text={cell} />
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
