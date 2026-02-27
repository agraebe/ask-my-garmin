'use client';

interface Props {
  connected: boolean | null; // null = still loading
  email?: string;
  onLoginClick: () => void;
  onLogout: () => void;
}

export default function GarminStatus({ connected, email, onLoginClick, onLogout }: Props) {
  if (connected === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-300" />
        Connecting…
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 text-sm text-gray-600"
          title={email ? `Connected as ${email}` : 'Connected'}
        >
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span>Connected</span>
          {email && (
            <span className="max-w-[120px] truncate text-xs text-gray-400 sm:max-w-none">
              ({email})
            </span>
          )}
        </div>
        <button
          onClick={onLogout}
          className="rounded-md px-3 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-red-600">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span className="hidden sm:inline">Not connected</span>
      </div>
      <button
        onClick={onLoginClick}
        className="rounded-md bg-garmin-blue px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
      >
        Sign in
      </button>
    </div>
  );
}
