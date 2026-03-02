import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GarminStatus from './GarminStatus';

const noop = () => {};

describe('GarminStatus', () => {
  it('shows a loading/connecting state when connected is null', () => {
    render(<GarminStatus connected={null} onLoginClick={noop} onLogout={noop} />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('shows "Connected" with email when connected', () => {
    render(
      <GarminStatus
        connected={true}
        email="runner@example.com"
        onLoginClick={noop}
        onLogout={noop}
      />
    );
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('(runner@example.com)')).toBeInTheDocument();
  });

  it('shows "Not connected" and a Connect button when disconnected', () => {
    render(<GarminStatus connected={false} onLoginClick={noop} onLogout={noop} />);
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
  });

  it('calls onLoginClick when Connect is clicked', async () => {
    const user = userEvent.setup();
    const onLoginClick = vi.fn();
    render(<GarminStatus connected={false} onLoginClick={onLoginClick} onLogout={noop} />);
    await user.click(screen.getByRole('button', { name: /connect/i }));
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
});
