'use client';

import { useState } from 'react';

interface GarminConnectProps {
  onConnected?: () => void;
  className?: string;
}

export default function GarminConnect({ onConnected, className = '' }: GarminConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    
    // Simulate connection process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsConnecting(false);
    setShowForm(false);
    onConnected?.();
    
    // Refresh the page to update the status
    window.location.reload();
  };

  if (!showForm) {
    return (
      <div className={`text-center space-y-4 ${className}`}>
        <div className="w-16 h-16 bg-garmin-blue rounded-2xl flex items-center justify-center mx-auto">
          <span className="text-white text-2xl font-bold">G</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Connect Your Garmin</h3>
          <p className="text-gray-600 text-sm mt-1">
            Connect your Garmin account to get personalized training insights based on your activity data.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-6 py-3 bg-garmin-blue text-white rounded-lg hover:bg-garmin-dark transition-colors font-medium"
        >
          Connect Garmin Account
        </button>
        <div className="text-xs text-gray-500 max-w-sm mx-auto">
          Your data is processed securely and never shared. This demo uses mock data for demonstration purposes.
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-6 max-w-md mx-auto ${className}`}>
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-garmin-blue rounded-xl flex items-center justify-center mx-auto mb-3">
          <span className="text-white text-lg font-bold">G</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Connect to Garmin</h3>
        <p className="text-gray-600 text-sm mt-1">
          Sign in with your Garmin Connect credentials
        </p>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email or Username
          </label>
          <input
            type="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-garmin-blue focus:border-transparent"
            placeholder="your-email@example.com"
            defaultValue="demo@example.com"
            disabled={isConnecting}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-garmin-blue focus:border-transparent"
            placeholder="••••••••"
            defaultValue="password"
            disabled={isConnecting}
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="remember"
            className="h-4 w-4 text-garmin-blue focus:ring-garmin-blue border-gray-300 rounded"
            disabled={isConnecting}
          />
          <label htmlFor="remember" className="ml-2 block text-sm text-gray-700">
            Keep me signed in
          </label>
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full px-4 py-3 bg-garmin-blue text-white rounded-lg hover:bg-garmin-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect to Garmin'
            )}
          </button>
          
          <button
            type="button"
            onClick={() => setShowForm(false)}
            disabled={isConnecting}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center space-y-1">
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <div className="font-medium text-blue-800 mb-1">Demo Mode</div>
            <div className="text-blue-700">
              This is a demonstration. Clicking "Connect" will always succeed and show mock data.
            </div>
          </div>
          <div className="mt-2">
            Your credentials are never stored. Data is processed securely and privately.
          </div>
        </div>
      </div>
    </div>
  );
}