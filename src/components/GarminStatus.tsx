'use client';

import { useEffect, useState } from 'react';

type Status = 'loading' | 'connected' | 'error';

export default function GarminStatus() {
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetch('/api/garmin/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setStatus('connected');
          setEmail(data.email ?? '');
        } else {
          setStatus('error');
          setErrorMsg(data.error ?? 'Could not connect to Garmin');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMsg('Network error');
      });
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-300" />
        Connecting…
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div
        className="flex items-center gap-2 text-sm text-gray-600"
        title={`Connected as ${email}`}
      >
        <span className="h-2 w-2 rounded-full bg-green-500" />
        <span>Connected</span>
        {email && <span className="text-xs text-gray-400">({email})</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-red-600" title={errorMsg}>
      <span className="h-2 w-2 rounded-full bg-red-500" />
      Not connected
    </div>
  );
}
