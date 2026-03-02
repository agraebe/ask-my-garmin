/**
 * Lightweight, zero-dependency Markdown renderer for assistant messages.
 * Handles: headings, paragraphs, bold, italic, inline code, fenced code blocks,
 * GFM tables, ordered/unordered lists, blockquotes, and horizontal rules.
 * Chart code blocks (```chart) are delegated to ChartBlock via the `renderCode` prop.
 */
import { Fragment } from 'react';
import type { ReactNode } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type HeadingBlock = { kind: 'heading'; level: 1 | 2 | 3; text: string };
type ParagraphBlock = { kind: 'paragraph'; lines: string[] };
type HrBlock = { kind: 'hr' };
type CodeBlock = { kind: 'code'; language: string; content: string };
type TableBlock = { kind: 'table'; headers: string[]; rows: string[][] };
type ListBlock = { kind: 'list'; ordered: boolean; items: string[] };
type BlockquoteBlock = { kind: 'blockquote'; lines: string[] };

type Block =
  | HeadingBlock
  | ParagraphBlock
  | HrBlock
  | CodeBlock
  | TableBlock
  | ListBlock
  | BlockquoteBlock;

// ── Inline parser ─────────────────────────────────────────────────────────────

/** Render inline Markdown (bold, italic, inline code, links) as React nodes. */
export function renderInline(text: string): ReactNode {
  // Split on inline markers — order matters: ** before *
  const segments = text.split(
    /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\))/
  );

  if (segments.length === 1) return text;

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
          return (
            <strong key={i} className="font-semibold text-white">
              {seg.slice(2, -2)}
            </strong>
          );
        }
        if (seg.startsWith('__') && seg.endsWith('__') && seg.length > 4) {
          return (
            <strong key={i} className="font-semibold text-white">
              {seg.slice(2, -2)}
            </strong>
          );
        }
        if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
          return (
            <code
              key={i}
              className="rounded bg-garmin-bg px-1 py-0.5 font-mono text-sm text-garmin-text"
            >
              {seg.slice(1, -1)}
            </code>
          );
        }
        if (seg.startsWith('*') && seg.endsWith('*') && seg.length > 2 && !seg.startsWith('**')) {
          return (
            <em key={i} className="italic">
              {seg.slice(1, -1)}
            </em>
          );
        }
        if (seg.startsWith('_') && seg.endsWith('_') && seg.length > 2 && !seg.startsWith('__')) {
          return (
            <em key={i} className="italic">
              {seg.slice(1, -1)}
            </em>
          );
        }
        const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(seg);
        if (lm) {
          return (
            <a
              key={i}
              href={lm[2]}
              className="text-garmin-blue underline"
              target="_blank"
              rel="noreferrer"
            >
              {lm[1]}
            </a>
          );
        }
        return seg || null;
      })}
    </>
  );
}

// ── Block parser ──────────────────────────────────────────────────────────────

function parseRow(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|/.test(line);
}

function isParagraphLine(line: string): boolean {
  return (
    line.trim() !== '' &&
    !/^#{1,3}\s/.test(line) &&
    !line.startsWith('```') &&
    !line.startsWith('|') &&
    !/^[-*+]\s/.test(line) &&
    !/^\d+\.\s/.test(line) &&
    !line.startsWith('> ') &&
    !/^[-*_]{3,}$/.test(line.trim())
  );
}

/** Parse Markdown content into a flat list of typed blocks. */
export function parseMarkdownBlocks(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Heading (H1–H3)
    const hm = /^(#{1,3})\s+(.+)$/.exec(line);
    if (hm) {
      const rawLevel = hm[1].length;
      const level: 1 | 2 | 3 = rawLevel === 1 ? 1 : rawLevel === 2 ? 2 : 3;
      blocks.push({ kind: 'heading', level, text: hm[2] });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }

    // Fenced code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing ```
      blocks.push({ kind: 'code', language, content: codeLines.join('\n') });
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ kind: 'blockquote', lines: bqLines });
      continue;
    }

    // GFM Table
    if (line.startsWith('|')) {
      const headers = parseRow(line);
      i++;
      if (i < lines.length && isTableSeparator(lines[i])) i++;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', headers, rows });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ kind: 'list', ordered: false, items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'list', ordered: true, items });
      continue;
    }

    // Paragraph — collect consecutive non-special lines
    const paraLines: string[] = [];
    while (i < lines.length && isParagraphLine(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ kind: 'paragraph', lines: paraLines });
    }
  }

  return blocks;
}

// ── Block renderer ─────────────────────────────────────────────────────────────

interface RenderOptions {
  /** Called for fenced code blocks so the consumer can handle 'chart' language. */
  renderCode: (language: string, content: string, key: number) => ReactNode;
}

export function renderBlock(block: Block, index: number, opts: RenderOptions): ReactNode {
  switch (block.kind) {
    case 'heading': {
      const cls = 'mb-2 font-semibold text-garmin-text';
      if (block.level === 1)
        return (
          <h1 key={index} className={`${cls} text-xl`}>
            {renderInline(block.text)}
          </h1>
        );
      if (block.level === 2)
        return (
          <h2 key={index} className={`${cls} text-lg`}>
            {renderInline(block.text)}
          </h2>
        );
      return (
        <h3 key={index} className={`${cls} text-base`}>
          {renderInline(block.text)}
        </h3>
      );
    }

    case 'paragraph':
      return (
        <p key={index} className="mb-2 last:mb-0">
          {block.lines.map((line, li) => (
            <Fragment key={li}>
              {li > 0 && <br />}
              {renderInline(line)}
            </Fragment>
          ))}
        </p>
      );

    case 'hr':
      return <hr key={index} className="my-3 border-garmin-border" />;

    case 'code':
      return opts.renderCode(block.language, block.content, index);

    case 'table':
      return (
        <div key={index} className="mb-2 overflow-x-auto">
          <table className="min-w-full border border-garmin-border text-sm">
            <thead className="bg-garmin-surface-2">
              <tr>
                {block.headers.map((h, hi) => (
                  <th key={hi} className="px-3 py-2 text-left font-semibold text-garmin-text">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-garmin-border last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-garmin-text-muted">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      const cls = block.ordered
        ? 'mb-2 list-inside list-decimal space-y-1 pl-2'
        : 'mb-2 list-inside list-disc space-y-1 pl-2';
      return (
        <Tag key={index} className={cls}>
          {block.items.map((item, ii) => (
            <li key={ii} className="text-garmin-text">
              {renderInline(item)}
            </li>
          ))}
        </Tag>
      );
    }

    case 'blockquote':
      return (
        <blockquote
          key={index}
          className="mb-2 border-l-2 border-garmin-blue pl-3 italic text-garmin-text-muted"
        >
          {block.lines.map((line, li) => (
            <Fragment key={li}>
              {li > 0 && <br />}
              {renderInline(line)}
            </Fragment>
          ))}
        </blockquote>
      );
  }
}
