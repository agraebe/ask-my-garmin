'use client';

import { useCallback, useEffect, useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import GarminStatus from '@/components/GarminStatus';
import LoginModal from '@/components/LoginModal';

type AuthState = 'loading' | 'connected' | 'disconnected';

const FUN_MODE_KEY = 'ask-my-garmin-fun-mode';

// Garmin-inspired navigation arrow icon
function GarminIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [email, setEmail] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [funMode, setFunMode] = useState(false);

  // Load funMode from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(FUN_MODE_KEY);
    if (stored === 'true') setFunMode(true);
  }, []);

  function toggleFunMode() {
    setFunMode((prev) => {
      const next = !prev;
      localStorage.setItem(FUN_MODE_KEY, String(next));
      return next;
    });
  }

  const checkStatus = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('garmin_session') ?? '';
      const url = token
        ? `/api/auth/status?session_token=${encodeURIComponent(token)}`
        : '/api/auth/status';
      const res = await fetch(url);
      const data = await res.json();
      if (data.connected) {
        setEmail(data.email ?? '');
        setAuthState('connected');
      } else {
        setAuthState('disconnected');
      }
    } catch {
      setAuthState('disconnected');
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    sessionStorage.removeItem('garmin_session');
    setAuthState('disconnected');
    setEmail('');
  }

  function handleLoginSuccess(token: string) {
    sessionStorage.setItem('garmin_session', token);
    setShowLogin(false);
    checkStatus();
  }

  const isLoading = authState === 'loading';
  const isConnected = authState === 'connected';

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${funMode ? 'bg-rcj' : 'bg-garmin-blue'}`}
            >
              <GarminIcon />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Ask My Garmin</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleFunMode}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                funMode
                  ? 'bg-rcj text-white hover:opacity-90'
                  : 'border border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              {funMode ? '🔥 RCJ Mode' : '🏃 Fun Mode'}
            </button>

            <GarminStatus
              connected={isLoading ? null : isConnected}
              email={email}
              onLoginClick={() => setShowLogin(true)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </header>

      {/* Login modal — shown when explicitly triggered or on first visit while disconnected */}
      {(showLogin || (!isLoading && !isConnected)) && <LoginModal onSuccess={handleLoginSuccess} />}

      <div className="mx-auto w-full max-w-4xl flex-1 overflow-hidden">
        <ChatInterface funMode={funMode} />
      </div>
    </main>
  );
}
