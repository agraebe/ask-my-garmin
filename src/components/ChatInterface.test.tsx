import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import ChatInterface from './ChatInterface';

// Default required props: user is connected, callbacks are no-ops
const defaultProps = {
  isConnected: true,
  onLoginRequired: vi.fn(),
  onSessionExpired: vi.fn(),
};

describe('ChatInterface', () => {
  it('shows suggested questions when there are no messages', () => {
    render(<ChatInterface {...defaultProps} />);
    expect(screen.getByText('Ask My Garmin')).toBeInTheDocument();
  });

  it('renders the textarea and send button', () => {
    render(<ChatInterface {...defaultProps} />);
    expect(screen.getByPlaceholderText(/ask about your activities/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('disables the send button when input is empty', () => {
    render(<ChatInterface {...defaultProps} />);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('enables the send button when user types', async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);
    await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'Hello');
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  it('clears the input immediately after submitting', async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);
    const input = screen.getByPlaceholderText(/ask about your activities/i);
    await user.type(input, 'How many miles?');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(input).toHaveValue('');
  });

  it('displays the user message bubble after submitting', async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);
    await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'How many miles?');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText('How many miles?')).toBeInTheDocument();
    });
  });

  it('shows the streamed assistant response', async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);
    await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'How many miles?');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText('This is a test response.')).toBeInTheDocument();
    });
  });

  it('hides suggested questions once messages are present', async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);
    await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(screen.queryByText('Ask My Garmin')).not.toBeInTheDocument();
    });
  });

  it('shows an error message when the API returns an error', async () => {
    server.use(
      http.post('/api/ask', () => HttpResponse.text('Service unavailable', { status: 503 }))
    );
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);
    await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'test question');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText(/Error:/i)).toBeInTheDocument();
    });
  });

  it('calls onSessionExpired and restores messages when the API returns 401', async () => {
    const onSessionExpired = vi.fn();
    server.use(
      http.post('/api/ask', () => HttpResponse.text('Session expired', { status: 401 }))
    );
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} onSessionExpired={onSessionExpired} />);
    await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'my question');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalledWith('my question');
    });
    // Messages should be restored to empty state (no user bubble)
    expect(screen.queryByText('my question')).not.toBeInTheDocument();
  });

  it('submits on Enter key press', async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);
    const input = screen.getByPlaceholderText(/ask about your activities/i);
    await user.type(input, 'How many miles?');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByText('How many miles?')).toBeInTheDocument();
    });
  });

  it('does not submit on Shift+Enter', async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);
    const input = screen.getByPlaceholderText(/ask about your activities/i);
    await user.type(input, 'Hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    // Suggested questions (empty state) should still be visible — no message sent
    expect(screen.getByText('Ask My Garmin')).toBeInTheDocument();
  });

  it('sends a question selected from suggested questions', async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);
    await user.click(screen.getByText('How many miles did I run this week?'));
    await waitFor(() => {
      // User bubble shows the selected question
      expect(screen.getAllByText('How many miles did I run this week?').length).toBeGreaterThan(0);
    });
  });

  it('includes fun_mode=false in the POST body by default', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/ask', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return new HttpResponse('response', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
    );
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);
    await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'test');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(capturedBody?.fun_mode).toBe(false);
    });
  });

  it('includes fun_mode=true in the POST body when funMode prop is true', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/ask', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return new HttpResponse('RCJ response', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
    );
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} funMode={true} />);
    await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'test');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(capturedBody?.fun_mode).toBe(true);
    });
  });

  it('shows RCJ suggested questions when funMode is true', () => {
    render(<ChatInterface {...defaultProps} funMode={true} />);
    expect(screen.getByText('RunBot 9000')).toBeInTheDocument();
  });
});
