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

  it('applies streaming cursor class when isStreaming=true', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: '' }} isStreaming />
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

  it('assistant bubble has white background class', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: 'Test' }} />
    );
    expect(container.querySelector('.bg-white')).toBeInTheDocument();
  });
});
