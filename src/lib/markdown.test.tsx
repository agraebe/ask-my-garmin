import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { parseMarkdownBlocks, renderInline } from '@/lib/markdown';

// Helper to render renderInline output inside a real DOM node
function Inline({ text }: { text: string }) {
  return <span>{renderInline(text)}</span>;
}

// ── renderInline ──────────────────────────────────────────────────────────────

describe('renderInline', () => {
  it('renders plain text unchanged', () => {
    render(<Inline text="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders **bold** as <strong>', () => {
    const { container } = render(<Inline text="**bold text**" />);
    const strong = container.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong).toHaveTextContent('bold text');
  });

  it('renders __bold__ as <strong>', () => {
    const { container } = render(<Inline text="__underline bold__" />);
    const strong = container.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong).toHaveTextContent('underline bold');
  });

  it('renders *italic* as <em>', () => {
    const { container } = render(<Inline text="*italicized*" />);
    const em = container.querySelector('em');
    expect(em).toBeInTheDocument();
    expect(em).toHaveTextContent('italicized');
  });

  it('renders _italic_ as <em>', () => {
    const { container } = render(<Inline text="_underscore italic_" />);
    const em = container.querySelector('em');
    expect(em).toBeInTheDocument();
    expect(em).toHaveTextContent('underscore italic');
  });

  it('renders `code` as <code>', () => {
    const { container } = render(<Inline text="`inline code`" />);
    const code = container.querySelector('code');
    expect(code).toBeInTheDocument();
    expect(code).toHaveTextContent('inline code');
  });

  it('renders [text](url) as an <a> with correct href, target and rel', () => {
    const { container } = render(<Inline text="[click here](https://example.com)" />);
    const link = container.querySelector('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('click here');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('renders mixed bold and italic in the same string', () => {
    const { container } = render(<Inline text="**Training Readiness**: *72*" />);
    expect(container.querySelector('strong')).toHaveTextContent('Training Readiness');
    expect(container.querySelector('em')).toHaveTextContent('72');
  });

  it('renders plain text when there are no inline markers', () => {
    render(<Inline text="No formatting here at all" />);
    expect(screen.getByText('No formatting here at all')).toBeInTheDocument();
  });
});

// ── parseMarkdownBlocks ───────────────────────────────────────────────────────

describe('parseMarkdownBlocks', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseMarkdownBlocks('')).toEqual([]);
  });

  it('returns an empty array for whitespace-only content', () => {
    expect(parseMarkdownBlocks('   \n\n   ')).toEqual([]);
  });

  it('parses an H1 heading', () => {
    const blocks = parseMarkdownBlocks('# Title');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ kind: 'heading', level: 1, text: 'Title' });
  });

  it('parses an H2 heading', () => {
    const blocks = parseMarkdownBlocks('## Section');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ kind: 'heading', level: 2, text: 'Section' });
  });

  it('parses an H3 heading', () => {
    const blocks = parseMarkdownBlocks('### Sub');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ kind: 'heading', level: 3, text: 'Sub' });
  });

  it('parses a single-line paragraph', () => {
    const blocks = parseMarkdownBlocks('Hello world');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'paragraph', lines: ['Hello world'] });
  });

  it('combines consecutive text lines into one paragraph block', () => {
    const blocks = parseMarkdownBlocks('Line one\nLine two\nLine three');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: 'paragraph',
      lines: ['Line one', 'Line two', 'Line three'],
    });
  });

  it('splits content into separate paragraph blocks at blank lines', () => {
    const blocks = parseMarkdownBlocks('Para one\n\nPara two');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: 'paragraph', lines: ['Para one'] });
    expect(blocks[1]).toMatchObject({ kind: 'paragraph', lines: ['Para two'] });
  });

  it('parses a horizontal rule with ---', () => {
    expect(parseMarkdownBlocks('---')).toEqual([{ kind: 'hr' }]);
  });

  it('parses a horizontal rule with ***', () => {
    expect(parseMarkdownBlocks('***')).toEqual([{ kind: 'hr' }]);
  });

  it('parses a fenced code block with a language tag', () => {
    const blocks = parseMarkdownBlocks('```python\nprint("hello")\n```');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: 'code',
      language: 'python',
      content: 'print("hello")',
    });
  });

  it('parses a fenced code block without a language tag', () => {
    const blocks = parseMarkdownBlocks('```\nsome code\n```');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'code', language: '', content: 'some code' });
  });

  it('parses a multi-line fenced code block', () => {
    const blocks = parseMarkdownBlocks('```js\nline1\nline2\nline3\n```');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'code', content: 'line1\nline2\nline3' });
  });

  it('parses a blockquote', () => {
    const blocks = parseMarkdownBlocks('> First line\n> Second line');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: 'blockquote',
      lines: ['First line', 'Second line'],
    });
  });

  it('parses a GFM table', () => {
    const md = '| Name | Score |\n|------|-------|\n| Alice | 95 |\n| Bob | 87 |';
    const blocks = parseMarkdownBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: 'table',
      headers: ['Name', 'Score'],
      rows: [
        ['Alice', '95'],
        ['Bob', '87'],
      ],
    });
  });

  it('parses an unordered list with - markers', () => {
    const blocks = parseMarkdownBlocks('- Item A\n- Item B');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: 'list',
      ordered: false,
      items: ['Item A', 'Item B'],
    });
  });

  it('parses an unordered list with * markers', () => {
    const blocks = parseMarkdownBlocks('* Alpha\n* Beta');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'list', ordered: false, items: ['Alpha', 'Beta'] });
  });

  it('parses an ordered list', () => {
    const blocks = parseMarkdownBlocks('1. First\n2. Second\n3. Third');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: 'list',
      ordered: true,
      items: ['First', 'Second', 'Third'],
    });
  });

  it('parses mixed content: heading + paragraph + unordered list', () => {
    const md = '## Summary\n\nSome text.\n\n- One\n- Two';
    const blocks = parseMarkdownBlocks(md);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 2, text: 'Summary' });
    expect(blocks[1]).toMatchObject({ kind: 'paragraph', lines: ['Some text.'] });
    expect(blocks[2]).toMatchObject({ kind: 'list', ordered: false });
  });

  it('parses a heading immediately followed by a list (no blank line between)', () => {
    const blocks = parseMarkdownBlocks('### Items\n- A\n- B');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: 'heading' });
    expect(blocks[1]).toMatchObject({ kind: 'list' });
  });

  it('parses a code block followed by a paragraph', () => {
    const md = '```\ncode here\n```\n\nAfter the code.';
    const blocks = parseMarkdownBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: 'code', content: 'code here' });
    expect(blocks[1]).toMatchObject({ kind: 'paragraph', lines: ['After the code.'] });
  });

  it('parses a chart code block (language = chart)', () => {
    const chartJson = '{"type":"bar","labels":["A"],"datasets":[{"label":"x","data":[1]}]}';
    const blocks = parseMarkdownBlocks(`\`\`\`chart\n${chartJson}\n\`\`\``);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'code', language: 'chart', content: chartJson });
  });
});
