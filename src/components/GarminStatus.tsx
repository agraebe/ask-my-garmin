'use client';

import { useEffect, useState } from 'react';

type Status = 'loading' | 'connected' | 'error';

interface SyncInfo {
  lastSyncTime?: string;
  totalActivities?: number;
  errors?: string[];
}

export default function GarminStatus() {
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [syncInfo, setSyncInfo] = useState<SyncInfo>({});
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Fetch connection status and sync info in parallel
    Promise.allSettled([
      fetch('/api/garmin/status').then((r) => r.json()),
      fetch('/api/garmin/sync').then((r) => r.json()),
    ]).then(([statusResult, syncResult]) => {
      // Handle status
      if (statusResult.status === 'fulfilled') {
        const statusData = statusResult.value;
        if (statusData.connected) {
          setStatus('connected');
          setEmail(statusData.email ?? '');
        } else {
          setStatus('error');
          setErrorMsg(statusData.error ?? 'Could not connect to Garmin');
        }
      } else {
        setStatus('error');
        setErrorMsg('Network error');
      }

      // Handle sync info
      if (syncResult.status === 'fulfilled' && syncResult.value.data) {
        const syncData = syncResult.value.data;
        setSyncInfo({
          lastSyncTime: syncData.lastSyncTime,
          totalActivities: syncData.totalActivities,
          errors: syncData.errors,
        });
      }
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
    const lastSyncDate = syncInfo.lastSyncTime ? new Date(syncInfo.lastSyncTime) : null;
    const timeAgo = lastSyncDate ? getTimeAgo(lastSyncDate) : 'unknown';
    
    return (
      <div className="relative">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          title={`Data connection with Garmin confirmed • Last sync: ${timeAgo}`}
        >
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span>Data connection confirmed</span>
          <span className="text-xs text-gray-500">({timeAgo})</span>
        </button>
        
        {showDetails && (
          <div className="absolute top-full right-0 mt-2 p-3 bg-white rounded-lg shadow-lg border border-gray-200 text-xs min-w-64 z-10">
            <div className="font-medium mb-2">Garmin Data Status</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Account:</span>
                <span className="font-mono">{email}</span>
              </div>
              {syncInfo.lastSyncTime && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Last sync:</span>
                  <span>{lastSyncDate?.toLocaleString()}</span>
                </div>
              )}
              {syncInfo.totalActivities && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Total activities:</span>
                  <span className="font-medium">{syncInfo.totalActivities.toLocaleString()}</span>
                </div>
              )}
              {syncInfo.errors && syncInfo.errors.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-amber-600 font-medium mb-1">Sync Issues:</div>
                  {syncInfo.errors.slice(0, 3).map((error, i) => (
                    <div key={i} className="text-amber-600 text-xs">{error}</div>
                  ))}
                  {syncInfo.errors.length > 3 && (
                    <div className="text-amber-600 text-xs">...and {syncInfo.errors.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-red-600" title={errorMsg}>
      <span className="h-2 w-2 rounded-full bg-red-500" />
      Garmin connection required
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
