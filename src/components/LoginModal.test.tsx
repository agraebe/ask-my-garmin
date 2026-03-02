import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import LoginModal from './LoginModal';

describe('LoginModal', () => {
  it('renders the credentials form by default', () => {
    render(<LoginModal onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('calls onSuccess after a successful login (no MFA)', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<LoginModal onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it('shows the MFA step when the server returns mfa_required', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ status: 'mfa_required', session_id: 'sess-123' })
      )
    );

    const user = userEvent.setup();
    render(<LoginModal onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument());
  });

  it('completes login after submitting MFA code', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ status: 'mfa_required', session_id: 'sess-123' })
      )
    );

    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<LoginModal onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument());

    // Typing all 6 digits triggers auto-submit — no need to click Verify
    await user.type(screen.getByLabelText(/verification code/i), '123456');

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it('shows an error message on login failure', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 })
      )
    );

    const user = userEvent.setup();
    render(<LoginModal onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/email/i), 'bad@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
  });

  it('navigates back to credentials from MFA step', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ status: 'mfa_required', session_id: 'sess-123' })
      )
    );

    const user = userEvent.setup();
    render(<LoginModal onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('shows loading state while the sign-in request is in flight', async () => {
    let unblock!: () => void;
    server.use(
      http.post('/api/auth/login', () =>
        new Promise<Response>((resolve) => {
          unblock = () => resolve(HttpResponse.json({ status: 'ok' }));
        })
      )
    );

    const user = userEvent.setup();
    render(<LoginModal onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Signing in…')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();

    // Resolve to avoid pending promise warnings
    unblock();
    await waitFor(() => expect(screen.queryByText('Signing in…')).not.toBeInTheDocument());
  });

  it('shows a network error message when the login fetch fails', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.error()));

    const user = userEvent.setup();
    render(<LoginModal onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument());
  });

  it('shows an error message on MFA verification failure', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ status: 'mfa_required', session_id: 'sess-123' })
      ),
      http.post('/api/auth/mfa', () =>
        HttpResponse.json({ detail: 'Invalid code' }, { status: 401 })
      )
    );

    const user = userEvent.setup();
    render(<LoginModal onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/verification code/i), '000000');

    await waitFor(() => expect(screen.getByText('Invalid code')).toBeInTheDocument());
  });

  it('clears the error message when navigating back from the MFA step', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ status: 'mfa_required', session_id: 'sess-123' })
      ),
      http.post('/api/auth/mfa', () =>
        HttpResponse.json({ detail: 'Bad code' }, { status: 401 })
      )
    );

    const user = userEvent.setup();
    render(<LoginModal onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/verification code/i), '000000');
    await waitFor(() => expect(screen.getByText('Bad code')).toBeInTheDocument());

    // Navigate back — error should be cleared
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.queryByText('Bad code')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('shows a network error message when the MFA fetch fails', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ status: 'mfa_required', session_id: 'sess-123' })
      ),
      http.post('/api/auth/mfa', () => HttpResponse.error())
    );

    const user = userEvent.setup();
    render(<LoginModal onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/verification code/i), '123456');

    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument());
  });
});
