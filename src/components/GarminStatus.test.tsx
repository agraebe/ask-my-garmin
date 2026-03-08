import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GarminStatus from './GarminStatus';

const noop = () => {};

describe('GarminStatus', () => {
  it('renders nothing when connected is null (loading)', () => {
    const { container } = render(
      <GarminStatus connected={null} onLoginClick={noop} onLogout={noop} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows only a Sign out button when connected', () => {
    render(
      <GarminStatus
        connected={true}
        email="runner@example.com"
        onLoginClick={noop}
        onLogout={noop}
      />
    );
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('shows only a Sign in button when disconnected', () => {
    render(<GarminStatus connected={false} onLoginClick={noop} onLogout={noop} />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('calls onLoginClick when Sign in is clicked', async () => {
    const user = userEvent.setup();
    const onLoginClick = vi.fn();
    render(<GarminStatus connected={false} onLoginClick={onLoginClick} onLogout={noop} />);
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(onLoginClick).toHaveBeenCalledOnce();
  });

  it('calls onLogout when Sign out is clicked', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(
      <GarminStatus
        connected={true}
        email="runner@example.com"
        onLoginClick={noop}
        onLogout={onLogout}
      />
    );
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('sets a descriptive title on the Sign out button when email is provided', () => {
    render(
      <GarminStatus connected={true} email="athlete@test.com" onLoginClick={noop} onLogout={noop} />
    );
    expect(screen.getByTitle('Signed in as athlete@test.com')).toBeInTheDocument();
  });

  it('sets a generic title on the Sign out button when no email is provided', () => {
    render(<GarminStatus connected={true} onLoginClick={noop} onLogout={noop} />);
    expect(screen.getByTitle('Signed in')).toBeInTheDocument();
  });
});
