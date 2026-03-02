'use client';

import { useCallback, useEffect, useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import GarminStatus from '@/components/GarminStatus';
import LoginModal from '@/components/LoginModal';
import MemoryPanel from '@/components/MemoryPanel';

type AuthState = 'loading' | 'connected' | 'disconnected';

const FUN_MODE_KEY = 'ask_my_garmin_fun_mode';

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

function MemoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        stroke="currentColor"
        strokeWidth="2"
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
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const [funMode, setFunMode] = useState<boolean>(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('garmin_session') ?? '';
      const url = token
        ? `/api/auth/status?session_token=${encodeURIComponent(token)}`
        : '/api/auth/status';
      const res = await fetch(url);
      const data = (await res.json()) as { connected: boolean; email?: string };
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

  useEffect(() => {
    setFunMode(localStorage.getItem(FUN_MODE_KEY) === 'true');
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    sessionStorage.removeItem('garmin_session');
    setAuthState('disconnected');
    setEmail('');
    setMemoryCount(0);
  }

  function handleLoginSuccess(token: string) {
    sessionStorage.setItem('garmin_session', token);
    setShowLogin(false);
    setAuthState('connected'); // optimistic: login just succeeded
    checkStatus(); // background: fills in the email display
  }

  function toggleFunMode() {
    const next = !funMode;
    setFunMode(next);
    localStorage.setItem(FUN_MODE_KEY, String(next));
  }

  const isLoading = authState === 'loading';
  const isConnected = authState === 'connected';

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex-shrink-0 border-b border-garmin-border bg-garmin-surface px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${funMode ? 'bg-rcj' : 'bg-garmin-blue'}`}
            >
              <GarminIcon />
            </div>
            <h1 className="text-lg font-semibold text-garmin-text">
              {funMode ? 'RunBot 9000' : 'Ask My Garmin'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFunMode}
              aria-pressed={funMode}
              title={funMode ? 'Disable Fun Mode' : 'Enable Fun Mode'}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                funMode
                  ? 'bg-rcj text-white'
                  : 'border border-garmin-border bg-garmin-surface-2 text-garmin-text-muted hover:border-garmin-blue hover:text-garmin-text'
              }`}
            >
              {funMode ? '🔥 RCJ Mode' : '🏃 Fun Mode'}
            </button>

            {isConnected && (
              <button
                onClick={() => setShowMemoryPanel(true)}
                aria-label="Open memory panel"
                title="Coach's Memory"
                className="relative flex items-center gap-1.5 rounded-full border border-garmin-border bg-garmin-surface-2 px-3 py-1 text-sm font-medium text-garmin-text-muted transition-colors hover:border-garmin-blue hover:text-garmin-text"
              >
                <MemoryIcon />
                <span className="hidden sm:inline">Memory</span>
                {memoryCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-garmin-blue px-1 text-xs font-bold text-white">
                    {memoryCount}
                  </span>
                )}
              </button>
            )}

            <GarminStatus
              connected={isLoading ? null : isConnected}
              email={email}
              onLoginClick={() => setShowLogin(true)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </header>

      {/* Login modal — only shown when explicitly triggered (e.g. intercepted send) */}
      {showLogin && <LoginModal onSuccess={handleLoginSuccess} />}

      {/* Memory panel */}
      {showMemoryPanel && (
        <MemoryPanel
          onClose={() => setShowMemoryPanel(false)}
          onMemoryCountChange={setMemoryCount}
        />
      )}

      <div className="mx-auto w-full max-w-4xl flex-1 overflow-hidden">
        <ChatInterface
          funMode={funMode}
          isConnected={isConnected}
          onLoginRequired={(q) => {
            setPendingQuestion(q);
            setShowLogin(true);
          }}
          pendingQuestion={pendingQuestion}
          onPendingQuestionHandled={() => setPendingQuestion(null)}
          onMemoryStored={() => setMemoryCount((c) => c + 1)}
        />
      </div>
    </main>
  );
}
