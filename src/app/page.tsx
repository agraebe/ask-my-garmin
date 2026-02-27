'use client';

import { useCallback, useEffect, useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import GarminStatus from '@/components/GarminStatus';
import LoginModal from '@/components/LoginModal';

type AuthState = 'loading' | 'connected' | 'disconnected';

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [email, setEmail] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status');
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
    setAuthState('disconnected');
    setEmail('');
  }

  function handleLoginSuccess() {
    setShowLogin(false);
    checkStatus();
  }

  const isLoading = authState === 'loading';
  const isConnected = authState === 'connected';

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-garmin-blue">
              <span className="select-none text-sm font-bold text-white">G</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Ask My Garmin</h1>
          </div>

          <GarminStatus
            connected={isLoading ? null : isConnected}
            email={email}
            onLoginClick={() => setShowLogin(true)}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* Login modal — shown when explicitly triggered or on first visit while disconnected */}
      {(showLogin || (!isLoading && !isConnected)) && <LoginModal onSuccess={handleLoginSuccess} />}

      <div
        className="mx-auto w-full max-w-4xl flex-1 overflow-hidden"
        style={{ height: 'calc(100vh - 65px)' }}
      >
        <ChatInterface />
      </div>
    </main>
  );
}
