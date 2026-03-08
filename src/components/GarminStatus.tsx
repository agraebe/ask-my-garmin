'use client';

interface Props {
  connected: boolean | null; // null = still loading
  email?: string;
  onLoginClick: () => void;
  onLogout: () => void;
}

export default function GarminStatus({ connected, email, onLoginClick, onLogout }: Props) {
  if (connected === null) {
    return null;
  }

  if (connected) {
    return (
      <button
        onClick={onLogout}
        title={email ? `Signed in as ${email}` : 'Signed in'}
        className="rounded-md px-3 py-1 text-xs text-garmin-text-muted transition-colors hover:bg-garmin-surface-2 hover:text-garmin-text"
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      onClick={onLoginClick}
      className="rounded-md bg-garmin-blue px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
    >
      Sign in
    </button>
  );
}
