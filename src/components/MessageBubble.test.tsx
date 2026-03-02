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
});
