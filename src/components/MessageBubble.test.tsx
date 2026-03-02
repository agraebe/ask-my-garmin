import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBubble from './MessageBubble';

describe('MessageBubble', () => {
  it('renders user message content', () => {
    render(<MessageBubble message={{ role: 'user', content: 'How far did I run?' }} />);
    expect(screen.getByText('How far did I run?')).toBeInTheDocument();
  });

  it('renders assistant message content', () => {
    render(<MessageBubble message={{ role: 'assistant', content: 'You ran 5 miles.' }} />);
    expect(screen.getByText('You ran 5 miles.')).toBeInTheDocument();
  });

  it('shows the Garmin icon avatar for assistant messages', () => {
    const { container } = render(<MessageBubble message={{ role: 'assistant', content: 'Hi' }} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not show an icon avatar for user messages', () => {
    const { container } = render(<MessageBubble message={{ role: 'user', content: 'Hi' }} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('shows thinking dots when isStreaming=true with empty content', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: '' }} isStreaming />
    );
    // Three bouncing dots rendered as spans
    expect(container.querySelectorAll('.animate-bounce')).toHaveLength(3);
    expect(container.querySelector('.cursor-blink')).not.toBeInTheDocument();
  });

  it('applies streaming cursor class when isStreaming=true with content', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: 'Hello' }} isStreaming />
    );
    expect(container.querySelector('.cursor-blink')).toBeInTheDocument();
  });

  it('does not apply streaming cursor when isStreaming=false', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: 'Done' }} isStreaming={false} />
    );
    expect(container.querySelector('.cursor-blink')).not.toBeInTheDocument();
  });

  it('user bubble has blue background class', () => {
    const { container } = render(<MessageBubble message={{ role: 'user', content: 'Test' }} />);
    // The user bubble should have the garmin-blue background
    const bubble = container.querySelector('.bg-garmin-blue');
    expect(bubble).toBeInTheDocument();
    expect(bubble).toHaveTextContent('Test');
  });

  it('assistant bubble has dark surface background class', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: 'Test' }} />
    );
    expect(container.querySelector('.bg-garmin-surface')).toBeInTheDocument();
  });

  // ── Markdown rendering ──────────────────────────────────────────────────────

  it('renders bold markdown as <strong> in assistant messages', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: '**Training Readiness**: 72' }} />
    );
    const strong = container.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong).toHaveTextContent('Training Readiness');
  });

  it('does not render markdown in user messages (plain text)', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'user', content: '**bold**' }} />
    );
    // User messages are plain text — no <strong> element
    expect(container.querySelector('strong')).not.toBeInTheDocument();
    expect(screen.getByText('**bold**')).toBeInTheDocument();
  });

  it('renders a GFM table for assistant messages', () => {
    const tableMarkdown = `| Date | Distance |
|------|----------|
| Feb 28 | 10.2 mi |
| Mar 1 | 6.5 mi |`;
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: tableMarkdown }} />
    );
    expect(container.querySelector('table')).toBeInTheDocument();
    expect(container.querySelector('thead')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('10.2 mi')).toBeInTheDocument();
  });

  it('renders headings for assistant messages', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: '## Training Summary' }} />
    );
    const h2 = container.querySelector('h2');
    expect(h2).toBeInTheDocument();
    expect(h2).toHaveTextContent('Training Summary');
  });

  it('renders unordered lists for assistant messages', () => {
    const { container } = render(
      <MessageBubble
        message={{ role: 'assistant', content: '- Run easy\n- Sleep 8 hours\n- Hydrate' }}
      />
    );
    const list = container.querySelector('ul');
    expect(list).toBeInTheDocument();
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  it('renders code blocks for assistant messages', () => {
    const { container } = render(
      <MessageBubble
        message={{ role: 'assistant', content: '```python\nprint("hello")\n```' }}
      />
    );
    expect(container.querySelector('pre')).toBeInTheDocument();
    expect(screen.getByText('print("hello")')).toBeInTheDocument();
  });

  it('shows "…" placeholder for empty assistant content when not streaming', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: '' }} isStreaming={false} />
    );
    // AssistantContent returns a <span>…</span> when blocks array is empty
    expect(container.querySelector('span')).toBeInTheDocument();
    expect(container.textContent).toContain('…');
  });

  it('renders a blockquote for assistant messages', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: '> Quoted text here' }} />
    );
    expect(container.querySelector('blockquote')).toBeInTheDocument();
    expect(screen.getByText('Quoted text here')).toBeInTheDocument();
  });

  it('renders a horizontal rule for assistant messages', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: '---' }} />
    );
    expect(container.querySelector('hr')).toBeInTheDocument();
  });

  it('renders an ordered list for assistant messages', () => {
    const { container } = render(
      <MessageBubble
        message={{ role: 'assistant', content: '1. Step one\n2. Step two\n3. Step three' }}
      />
    );
    expect(container.querySelector('ol')).toBeInTheDocument();
    expect(container.querySelectorAll('li')).toHaveLength(3);
    expect(screen.getByText('Step one')).toBeInTheDocument();
  });

  it('renders an H1 heading for assistant messages', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: '# Top Level Heading' }} />
    );
    const h1 = container.querySelector('h1');
    expect(h1).toBeInTheDocument();
    expect(h1).toHaveTextContent('Top Level Heading');
  });

  it('renders an H3 heading for assistant messages', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: '### Sub Heading' }} />
    );
    const h3 = container.querySelector('h3');
    expect(h3).toBeInTheDocument();
    expect(h3).toHaveTextContent('Sub Heading');
  });

  it('renders inline code in assistant messages', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: 'Run `npm install` first' }} />
    );
    expect(container.querySelector('code')).toBeInTheDocument();
    expect(screen.getByText('npm install')).toBeInTheDocument();
  });

  it('renders italic text in assistant messages', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: 'This is *emphasized* text' }} />
    );
    expect(container.querySelector('em')).toHaveTextContent('emphasized');
  });

  it('renders links in assistant messages', () => {
    const { container } = render(
      <MessageBubble
        message={{
          role: 'assistant',
          content: 'See [Garmin Connect](https://connect.garmin.com)',
        }}
      />
    );
    const link = container.querySelector('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('Garmin Connect');
    expect(link).toHaveAttribute('href', 'https://connect.garmin.com');
  });

  it('preserves whitespace in user messages with newlines', () => {
    render(
      <MessageBubble message={{ role: 'user', content: 'Line one\nLine two' }} />
    );
    // User messages use whitespace-pre-wrap so newlines are preserved in the DOM
    expect(screen.getByText('Line one\nLine two')).toBeInTheDocument();
  });
});
