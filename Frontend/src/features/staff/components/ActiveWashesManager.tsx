// src/features/staff/components/ActiveWashesManager.tsx
import React, { useState, useMemo } from 'react';
import { timeDerivation } from '../perf/counters';
import { useActiveWashes, useEndWash } from '../hooks';
import type { EndWashResponse } from '../hooks/useEndWash';
import { toast } from 'react-toastify';
import LoadingFallback from '../../../components/LoadingFallback';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { Wash } from '../../../types';
import './ActiveWashesManager.css';

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

  const getDurationClass = () => {
    if (durationMinutes < 30) return 'duration-normal';
    if (durationMinutes < 60) return 'duration-warning';
    return 'duration-critical';
  };

  return (
    <div className="active-wash-card">
      <div className="wash-card-header">
        <div className="customer-info">
          <h3 className="customer-name">
            {wash.user?.first_name} {wash.user?.last_name}
          </h3>
          <p className="contact-info">
            {wash.user?.phone && (
              <span className="phone">📞 {wash.user.phone}</span>
            )}
          </p>
        </div>
        <div className={`duration-badge ${getDurationClass()}`}>
          <span className="duration-icon">⏱️</span>
          <span className="duration-text">{formatDuration()}</span>
        </div>
      </div>

      <div className="wash-card-body">
        {wash.vehicle && (
          <div className="vehicle-info">
            <div className="vehicle-details">
              <span className="vehicle-icon">🚗</span>
              <div className="vehicle-text">
                <span className="vehicle-model">
                  {wash.vehicle.make} {wash.vehicle.model}
                </span>
                <span className="vehicle-reg">{wash.vehicle.reg}</span>
              </div>
            </div>
          </div>
        )}

        <div className="service-info">
          <span className="service-icon">🧽</span>
          <span className="service-name">{wash.service_name || 'Standard Wash'}</span>
        </div>

        <div className="timing-info">
          <div className="time-detail">
            <span className="time-label">Started:</span>
            <span className="time-value">
              {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="time-detail">
            <span className="time-label">Duration:</span>
            <span className={`time-value ${getDurationClass()}`}>
              {wash.duration_seconds && wash.ended_at ? `${Math.floor((wash.duration_seconds)/60)}m` : formatDuration()}
            </span>
          </div>
        </div>
      </div>

      <div className="wash-card-actions">
        <button
          onClick={() => onEndWash(wash.order_id)}
          disabled={isEnding}
          className="end-wash-btn"
        >
          {isEnding ? (
            <>
              <span className="loading-spinner">⏳</span>
              Ending...
            </>
          ) : (
            <>
              <span className="end-icon">✅</span>
              Complete Wash
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
    <div className="active-washes-manager">
      <ConfirmDialog
        isOpen={!!confirmWash}
        title="Complete Wash"
        description="Are you sure you want to mark this wash as completed? This action cannot be undone."
        confirmLabel="Yes, Complete Wash"
        onConfirm={confirmEnd}
        onCancel={() => setConfirmWash(null)}
        loading={endWashMutation.status === 'pending'}
      />

      <div className="manager-header">
        <div className="header-title">
          <h2>Active Washes</h2>
          <p>Monitor and manage ongoing car washes</p>
        </div>
        
        <div className="status-summary">
          <div className="status-card">
            <span className="status-number">{total}</span>
            <span className="status-label">Active</span>
          </div>
          {longRunning > 0 && (
            <div className="status-card warning">
              <span className="status-number">{longRunning}</span>
              <span className="status-label">Long Running</span>
            </div>
          )}
          <div className="status-card controls">
            <label className="auto-refresh-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={() => setAutoRefresh(a => !a)}
              /> Auto Refresh
            </label>
            <button
              className="manual-refresh-btn"
              onClick={() => refetch()}
              aria-label="Manual refresh active washes"
            >↻</button>
          </div>
        </div>
      </div>

      <div className="washes-container">
        {activeWashes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧽</div>
            <h3>No Active Washes</h3>
            <p>All washes have been completed. Great job!</p>
          </div>
        ) : (
          <div className="washes-grid">
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
