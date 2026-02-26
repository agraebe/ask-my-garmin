'use client';

import { useEffect, useState } from 'react';
import type { GarminDataSync } from '@/types';

interface DataExplorerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DataExplorer({ isOpen, onClose }: DataExplorerProps) {
  const [syncData, setSyncData] = useState<GarminDataSync | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSyncData();
    }
  }, [isOpen]);

  const fetchSyncData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/garmin/sync');
      const result = await response.json();
      
      if (result.data) {
        setSyncData(result.data);
      } else {
        setError('No sync data available');
      }
    } catch (err) {
      setError('Failed to fetch sync data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Garmin Data Explorer</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-gray-500">Loading sync data...</div>
            </div>
          ) : error ? (
            <div className="text-red-600 py-8 text-center">{error}</div>
          ) : syncData ? (
            <div className="space-y-6">
              {/* Sync Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Last Sync Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Sync Time:</span>
                    <div className="font-medium">
                      {new Date(syncData.lastSyncTime).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Activities:</span>
                    <div className="font-medium text-garmin-blue">
                      {syncData.totalActivities.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Date Range:</span>
                    <div className="font-medium">
                      {new Date(syncData.dateRange.earliest).toLocaleDateString()} - {' '}
                      {new Date(syncData.dateRange.latest).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Coverage:</span>
                    <div className="font-medium">
                      {Math.floor((Date.now() - new Date(syncData.dateRange.earliest).getTime()) / (1000 * 60 * 60 * 24))} days
                    </div>
                  </div>
                </div>
              </div>

              {/* Files Processed */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Files Processed in Last Sync</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-green-800 font-medium">Activity Files</div>
                    <div className="text-2xl font-bold text-green-900">
                      {syncData.filesProcessed.activities}
                    </div>
                    <div className="text-xs text-green-600">FIT files parsed successfully</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-blue-800 font-medium">Sleep Files</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {syncData.filesProcessed.sleepFiles}
                    </div>
                    <div className="text-xs text-blue-600">Sleep sessions analyzed</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="text-purple-800 font-medium">Heart Rate Files</div>
                    <div className="text-2xl font-bold text-purple-900">
                      {syncData.filesProcessed.hrFiles}
                    </div>
                    <div className="text-xs text-purple-600">HR data points processed</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="text-amber-800 font-medium">Training Files</div>
                    <div className="text-2xl font-bold text-amber-900">
                      {syncData.filesProcessed.trainingFiles}
                    </div>
                    <div className="text-xs text-amber-600">Training metrics calculated</div>
                  </div>
                </div>
              </div>

              {/* Data Quality & Errors */}
              {syncData.errors && syncData.errors.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Data Quality Issues</h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="space-y-2">
                      {syncData.errors.map((error, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
                          <div className="text-sm text-amber-800">{error}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Data Types Available */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Available Data Types</h3>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                    <span>Activities & Performance</span>
                    <span className="text-green-600 font-medium">✓ Available</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                    <span>Sleep & Recovery</span>
                    <span className="text-green-600 font-medium">✓ Available</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                    <span>Heart Rate Zones</span>
                    <span className="text-green-600 font-medium">✓ Available</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                    <span>Training Load & Stress</span>
                    <span className="text-green-600 font-medium">✓ Available</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                    <span>Body Battery & HRV</span>
                    <span className="text-green-600 font-medium">✓ Available</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="text-xs text-gray-500">
            This data is used to provide personalized training insights and answer your fitness questions.
            All data remains private and is not shared with third parties.
          </div>
        </div>
      </div>
    </div>
  );
}