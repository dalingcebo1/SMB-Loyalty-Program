// src/features/staff/components/ActiveWashesManager.tsx
import React, { useState, useMemo } from 'react';
import { timeDerivation } from '../perf/counters';
import { useActiveWashes, useEndWash } from '../hooks';
import type { EndWashResponse } from '../hooks/useEndWash';
import { toast } from 'react-toastify';
import LoadingFallback from '../../../components/LoadingFallback';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { Wash } from '../../../types';

interface ActiveWashCardProps {
  wash: Wash;
  onEndWash: (orderId: string) => void;
  isEnding: boolean;
}

const ActiveWashCardComponent: React.FC<ActiveWashCardProps> = ({ wash, onEndWash, isEnding }) => {
  const startTime = new Date(wash.started_at);
  const currentTime = new Date();
  const durationMs = wash.ended_at ? (new Date(wash.ended_at).getTime() - startTime.getTime()) : (currentTime.getTime() - startTime.getTime());
  const durationMinutes = Math.floor(durationMs / 60000);
  const durationHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;

  const formatDuration = () => {
    if (durationHours > 0) {
      return `${durationHours}h ${remainingMinutes}m`;
    }
    return `${durationMinutes}m`;
  };

  const getDurationStyle = () => {
    if (durationMinutes < 30) return 'bg-green-100 text-green-800 border-green-200';
    if (durationMinutes < 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {wash.user?.first_name} {wash.user?.last_name}
              </h3>
              {wash.user?.phone && (
                <div className="flex items-center space-x-1 text-sm text-gray-500">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  <span>{wash.user.phone}</span>
                </div>
              )}
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getDurationStyle()}`}>
            <div className="flex items-center space-x-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>{formatDuration()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {wash.vehicle && (
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="p-2 bg-green-50 rounded-lg">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-900">
                {wash.vehicle.make} {wash.vehicle.model}
              </div>
              <div className="text-sm text-gray-500">{wash.vehicle.reg}</div>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">{wash.service_name || 'Standard Wash'}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <span className="text-xs text-gray-500 block">Started</span>
            <span className="text-sm font-medium text-gray-900">
              {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-500 block">Duration</span>
            <span className="text-sm font-medium text-gray-900">
              {wash.duration_seconds && wash.ended_at ? `${Math.floor((wash.duration_seconds)/60)}m` : formatDuration()}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-100 bg-gray-50">
        <button
          onClick={() => onEndWash(wash.order_id)}
          disabled={isEnding}
          className="w-full inline-flex items-center justify-center px-4 py-2 bg-red-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isEnding ? (
            <>
              <svg className="w-4 h-4 mr-2 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4z" />
              </svg>
              Ending...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v3.586l2.707 2.707a1 1 0 01-1.414 1.414l-3-3A1 1 0 018 10V7z" clipRule="evenodd" />
              </svg>
              End Wash
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Avoid re-rendering unchanged cards
const ActiveWashCard = React.memo(ActiveWashCardComponent);

const ActiveWashesManager: React.FC = () => {
  // Allow faster local UI duration tick separate from network polling
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data: activeWashes = [], isLoading, refetch } = useActiveWashes(autoRefresh ? 15000 : 0);

  const endWashMutation = useEndWash();
  const [confirmWash, setConfirmWash] = useState<string | null>(null);
  const { total, longRunning } = useMemo(() => timeDerivation(
    'activeWashesStatusPasses',
    'activeWashesStatusDerivationMs',
    () => {
    const total = activeWashes.length;
    let longRunning = 0;
    const now = Date.now();
    for (const wash of activeWashes) {
      if (now - new Date(wash.started_at).getTime() > 60 * 60 * 1000) longRunning++;
    }
    return { total, longRunning };
  }), [activeWashes]);

  if (isLoading) {
    return <LoadingFallback message="Loading active washes..." />;
  }

  const handleEndClick = (orderId: string) => {
    setConfirmWash(orderId);
  };

  const confirmEnd = () => {
    if (!confirmWash) return;
    
    endWashMutation.mutate(confirmWash, {
      onSuccess: (data: EndWashResponse) => {
        if (data.status === 'already_completed') {
          toast.info('Wash was already completed.');
        } else if (data.status === 'ended') {
          const dur = data.duration_seconds ? Math.round(data.duration_seconds / 60) : null;
          toast.success(`Wash completed successfully! ${dur !== null ? `(${dur}m)` : ''} 🎉`);
        } else {
          toast.success('Wash updated.');
        }
        refetch();
      },
      onError: (error) => {
        console.error('Error ending wash:', error);
        toast.error('Failed to complete wash. Please try again.');
      },
      onSettled: () => setConfirmWash(null),
    });
  };

  // metrics already memoized above

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <ConfirmDialog
        isOpen={!!confirmWash}
        title="Complete Wash"
        description="Are you sure you want to mark this wash as completed? This action cannot be undone."
        confirmLabel="Yes, Complete Wash"
        onConfirm={confirmEnd}
        onCancel={() => setConfirmWash(null)}
        loading={endWashMutation.status === 'pending'}
      />

      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Active Washes</h2>
              <p className="text-sm text-gray-500">Monitor and manage ongoing car washes</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Status Summary */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-lg font-semibold text-blue-700">{total}</span>
                <span className="text-sm text-blue-600">Active</span>
              </div>
              {longRunning > 0 && (
                <div className="flex items-center space-x-2 px-3 py-2 bg-orange-50 rounded-lg border border-orange-200">
                  <span className="text-lg font-semibold text-orange-700">{longRunning}</span>
                  <span className="text-sm text-orange-600">Long Running</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={() => setAutoRefresh(a => !a)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Auto Refresh</span>
              </label>
              <button
                onClick={() => refetch()}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Manual refresh active washes"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeWashes.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Washes</h3>
            <p className="text-gray-500">All washes have been completed. Great job!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {activeWashes.map((wash) => (
              <ActiveWashCard
                key={wash.order_id}
                wash={wash}
                onEndWash={handleEndClick}
                isEnding={endWashMutation.status === 'pending' && confirmWash === wash.order_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveWashesManager;
