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
        <span className="h-2 w-2 rounded-full bg-gray-300 animate-pulse" />
        Connecting…
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600" title={email}>
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Connected
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
