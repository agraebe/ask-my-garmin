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

    await user.type(screen.getByLabelText(/verification code/i), '123456');
    await user.click(screen.getByRole('button', { name: /verify/i }));

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
});
