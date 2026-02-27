'use client';

import { useState } from 'react';

interface Props {
  onSuccess: (token: string) => void;
}

type Step = 'credentials' | 'mfa';

// Garmin-inspired navigation arrow SVG icon
function GarminIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LoginModal({ onSuccess }: Props) {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Login failed');
        return;
      }

      if (data.status === 'mfa_required') {
        setSessionId(data.session_id);
        setStep('mfa');
      } else {
        sessionStorage.setItem('garmin_session', data.session_token ?? '');
        onSuccess(data.session_token ?? '');
      }
    } catch {
      setError('Network error — is the Python backend running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, code: mfaCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Verification failed');
        return;
      }

      sessionStorage.setItem('garmin_session', data.session_token ?? '');
      onSuccess(data.session_token ?? '');
    } catch {
      setError('Network error — is the Python backend running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        {/* Logo + title */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-garmin-blue text-white">
            <GarminIcon size={22} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">Connect your Garmin account</h1>
            <p className="mt-1 text-sm text-gray-500">
              {step === 'credentials'
                ? 'This app accesses your Garmin Connect data on your behalf.'
                : 'Enter the code from your authenticator app or SMS'}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentials} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-garmin-blue"
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-garmin-blue"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-garmin-blue py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            {/* Security notice */}
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
              <svg
                className="h-3.5 w-3.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              Your credentials are sent securely and never stored.
            </p>
          </form>
        ) : (
          <form onSubmit={handleMfa} className="flex flex-col gap-4">
            <div>
              <label htmlFor="mfa-code" className="mb-1 block text-sm font-medium text-gray-700">
                Verification code
              </label>
              <input
                id="mfa-code"
                type="text"
                required
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                autoFocus
                placeholder="000000"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-center font-mono text-lg tracking-widest focus:border-transparent focus:outline-none focus:ring-2 focus:ring-garmin-blue"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-garmin-blue py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('credentials');
                setError('');
                setMfaCode('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
