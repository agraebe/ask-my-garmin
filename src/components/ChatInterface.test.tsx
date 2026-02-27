import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import ChatInterface from './ChatInterface';

describe('ChatInterface', () => {
  it('shows suggested questions when there are no messages', () => {
    render(<ChatInterface />);
    expect(screen.getByText('Ask My Garmin')).toBeInTheDocument();
  });

  it('renders the textarea and send button', () => {
    render(<ChatInterface />);
    expect(screen.getByPlaceholderText(/ask about your activities/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('disables the send button when input is empty', () => {
    render(<ChatInterface />);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('enables the send button when user types', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);
    await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'Hello');
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  it('clears the input immediately after submitting', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);
    const input = screen.getByPlaceholderText(/ask about your activities/i);
    await user.type(input, 'How many miles?');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(input).toHaveValue('');
  });

  it('displays the user message bubble after submitting', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);
    await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'How many miles?');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText('How many miles?')).toBeInTheDocument();
    });
  });

  it('shows the streamed assistant response', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);
    await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'How many miles?');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText('This is a test response.')).toBeInTheDocument();
    });
  });

  it('hides suggested questions once messages are present', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);
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
    render(<ChatInterface />);
    await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'test question');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText(/Error:/i)).toBeInTheDocument();
    });
  });

  it('submits on Enter key press', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);
    const input = screen.getByPlaceholderText(/ask about your activities/i);
    await user.type(input, 'How many miles?');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByText('How many miles?')).toBeInTheDocument();
    });
  });

  it('does not submit on Shift+Enter', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);
    const input = screen.getByPlaceholderText(/ask about your activities/i);
    await user.type(input, 'Hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    // Suggested questions (empty state) should still be visible — no message sent
    expect(screen.getByText('Ask My Garmin')).toBeInTheDocument();
  });

  it('sends a question selected from suggested questions', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);
    await user.click(screen.getByText('How many miles did I run this week?'));
    await waitFor(() => {
      // User bubble shows the selected question
      expect(screen.getAllByText('How many miles did I run this week?').length).toBeGreaterThan(0);
    });
  });

  describe('funMode', () => {
    it('shows RCJ suggested questions when funMode is true', () => {
      render(<ChatInterface funMode={true} />);
      expect(screen.getByText('RunningCircleJerk Mode')).toBeInTheDocument();
      expect(screen.getByText(/Vaporfly/i)).toBeInTheDocument();
    });

    it('includes fun_mode=true in POST body when funMode prop is true', async () => {
      let capturedBody: Record<string, unknown> = {};
      server.use(
        http.post('/api/ask', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return new HttpResponse('RCJ response.', {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
      );

      const user = userEvent.setup();
      render(<ChatInterface funMode={true} />);
      await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'test');
      await user.click(screen.getByRole('button', { name: /send/i }));
      await waitFor(() => {
        expect(capturedBody.fun_mode).toBe(true);
      });
    });

    it('includes fun_mode=false in POST body when funMode prop is false', async () => {
      let capturedBody: Record<string, unknown> = {};
      server.use(
        http.post('/api/ask', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return new HttpResponse('Normal response.', {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
      );

      const user = userEvent.setup();
      render(<ChatInterface funMode={false} />);
      await user.type(screen.getByPlaceholderText(/ask about your activities/i), 'test');
      await user.click(screen.getByRole('button', { name: /send/i }));
      await waitFor(() => {
        expect(capturedBody.fun_mode).toBe(false);
      });
    });
  });
});
