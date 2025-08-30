// src/features/staff/components/EnhancedPaymentVerification.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useActiveWashes } from '../hooks/useActiveWashes';
import { useStartWash } from '../hooks/useStartWash';
import { useRecentVerifications, useVerifyPayment, VerifiedPaymentDetails } from '../hooks/usePaymentVerification';
import ConfirmDialog from '../../../components/ConfirmDialog';
import './EnhancedPaymentVerification.css';
import { formatCurrency, formatRelativeTime, formatDateTime } from '../../../utils/format';

// Using VerifiedPaymentDetails directly from hook types

const EnhancedPaymentVerification: React.FC = () => {
  const [verificationMethod, setVerificationMethod] = useState<'qr' | 'manual' | 'pin'>('qr');
  const [manualRef, setManualRef] = useState('');
  const [manualPin, setManualPin] = useState('');
  const { data: verificationHistory = [], refetch: refetchRecent } = useRecentVerifications(10, true);
  const [starting, setStarting] = useState(false);
  const [autoRefreshHistory, setAutoRefreshHistory] = useState(true);
  const [historyTick, setHistoryTick] = useState(0);
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<VerifiedPaymentDetails | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ plate: '', make: '', model: '' });
  const [linkingVehicleId, setLinkingVehicleId] = useState<number | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [dailyStats, setDailyStats] = useState({
    total_verified: 0,
    total_amount: 0,
    success_rate: 0,
    avg_processing_time: 0
  });

  // Hooks
  const { refetch: refetchActiveWashes } = useActiveWashes();
  const startWashMutation = useStartWash();

  // Load daily statistics
  const loadDailyStats = useCallback(async () => {
    try {
      // This would call a new analytics endpoint
      // For now, we'll calculate from verification history
      const today = new Date().toISOString().split('T')[0];
      const todayVerifications = verificationHistory.filter(v => 
        v.timestamp.startsWith(today)
      );
      
      const total_verified = todayVerifications.length;
      const successful = todayVerifications.filter(v => v.status === 'success');
  const total_amount = successful.reduce((sum, v) => sum + (v.amount || 0), 0);
      const success_rate = total_verified > 0 ? (successful.length / total_verified) * 100 : 0;
      
      setDailyStats({
        total_verified,
        total_amount,
        success_rate,
        avg_processing_time: 2.3 // Mock data
      });
    } catch (error) {
      console.error('Failed to load daily stats:', error);
    }
  }, [verificationHistory]);

  const loadVerificationHistory = useCallback(() => { refetchRecent(); }, [refetchRecent]);

  useEffect(() => {
    loadDailyStats();
    loadVerificationHistory();
  }, [loadDailyStats, loadVerificationHistory]);

  // Auto refresh recent verifications
  useEffect(() => {
    if (!autoRefreshHistory) return;
    const id = setInterval(() => setHistoryTick(t => t + 1), 10000); // 10s
    return () => clearInterval(id);
  }, [autoRefreshHistory]);
  useEffect(() => { if (autoRefreshHistory) loadVerificationHistory(); }, [historyTick, autoRefreshHistory, loadVerificationHistory]);

  // Keep reference to active QR scanner so we can stop it on unmount / toggle
  interface QRLike {
    stop: () => Promise<void> | void;
    clear: () => Promise<void> | void;
  }
  const qrInstanceRef = useRef<QRLike | null>(null);

  // Lazy load html5-qrcode only when scanning to keep initial bundle light
  const startRealScanner = async () => {
    try {
  const { Html5Qrcode } = await import('html5-qrcode');
  // Type for html5-qrcode config; minimal fields used
  const cameraConfig: { fps: number; qrbox: number } = { fps: 10, qrbox: 250 };
      const scannerId = 'real-qr-reader';
      const el = document.getElementById(scannerId);
      if (!el) return;
      const html5QrCode = new Html5Qrcode(scannerId);
      qrInstanceRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: 'environment' },
        cameraConfig,
        (decodedText: string) => {
          html5QrCode.stop().catch(() => {});
          setIsScanning(false); // triggers cleanup effect
          verifyPayment(decodedText);
        },
        (err: unknown) => {
          // Silently ignore scan errors (common with partial/blurred frames)
          if (process.env.NODE_ENV === 'development') {
            console.debug('QR scan frame error', err);
          }
        }
      );
    } catch (err) {
      console.error('QR scanner init failed, fallback to mock:', err);
    }
  };

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (qrInstanceRef.current) {
  try { qrInstanceRef.current.stop(); } catch { /* ignore */ }
  try { qrInstanceRef.current.clear(); } catch { /* ignore */ }
        qrInstanceRef.current = null;
      }
    };
  }, []);

  // When scanning toggled off, ensure camera released
  useEffect(() => {
    if (!isScanning && qrInstanceRef.current) {
      try { qrInstanceRef.current.stop(); } catch { /* ignore */ }
      try { qrInstanceRef.current.clear(); } catch { /* ignore */ }
      qrInstanceRef.current = null;
    }
  }, [isScanning]);

  const handleManualVerification = async () => {
    if (verificationMethod === 'manual' && manualRef) {
      await verifyPayment(manualRef);
    } else if (verificationMethod === 'pin' && manualPin) {
      await verifyByPin(manualPin);
    }
  };

  const verifyMutation = useVerifyPayment();
  const verifyPayment = async (reference: string) => {
    setProcessingPayment(true);
    try {
  const data = await verifyMutation.mutateAsync({ token: reference, type: 'ref' });
  setSelectedPayment(data);
      setShowConfirmDialog(true);
      toast.success(data.status === 'already_redeemed' ? 'Payment already redeemed' : 'Payment verified successfully!');
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Error during verification');
    } finally {
      setProcessingPayment(false);
      setManualRef('');
      setManualPin('');
    }
  };

  const verifyByPin = async (pin: string) => {
    setProcessingPayment(true);
    try {
  const data = await verifyMutation.mutateAsync({ token: pin, type: 'pin' });
  setSelectedPayment(data);
      setShowConfirmDialog(true);
      toast.success(data.status === 'already_redeemed' ? 'Payment already redeemed' : 'Payment verified by PIN!');
    } catch (error) {
      console.error('PIN verification error:', error);
      toast.error('Error during PIN verification');
    } finally {
      setProcessingPayment(false);
      setManualPin('');
    }
  };

  const confirmStartWash = async () => {
    if (!selectedPayment || starting) return;
    try {
      if (!selectedPayment.vehicle?.id) {
        setShowVehicleModal(true);
        return;
      }
      setStarting(true);
      await startWashMutation.mutateAsync({ orderId: selectedPayment.order_id, vehicleId: selectedPayment.vehicle.id });
      setShowConfirmDialog(false);
      setSelectedPayment(null);
  refetchActiveWashes();
  loadVerificationHistory();
  // Navigate to dashboard to monitor active wash
  navigate('/staff/dashboard');
    } catch (error: unknown) {
      interface RespLike { data?: { detail?: string } }
      interface ErrorLike { response?: RespLike }
      let detail: string | undefined
      if (typeof error === 'object' && error) {
        const maybe = error as ErrorLike
        detail = maybe.response?.data?.detail
      }
      if (!detail && error instanceof Error) detail = error.message
      console.error('Error starting wash:', detail, error)
      toast.error(`Failed to start wash${detail ? ': ' + detail : ''}`)
    } finally {
      setStarting(false);
    }
  };

  const handleCreateVehicle = async () => {
    if (!selectedPayment?.user) return;
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`/api/users/${selectedPayment.user.id}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plate: newVehicle.plate, make: newVehicle.make, model: newVehicle.model })
      });
      if (!resp.ok) throw new Error('Failed to add vehicle');
      const veh = await resp.json();
      setSelectedPayment(prev => prev ? { ...prev, vehicle: { id: veh.id, reg: veh.plate, make: veh.make, model: veh.model } } : prev);
      setShowVehicleModal(false);
      toast.success('Vehicle added and linked');
    } catch (e) {
      console.error(e);
      toast.error('Could not add vehicle');
    }
  };

  const handleLinkVehicle = async () => {
    if (!selectedPayment?.user || linkingVehicleId == null) return;
    try {
      // Linking simply sets the selected vehicle client-side; if order->vehicle relation needed we could call an API
      const v = selectedPayment.available_vehicles?.find(v => v.id === linkingVehicleId);
      if (!v) return;
      setSelectedPayment(prev => prev ? { ...prev, vehicle: v } : prev);
      setShowVehicleModal(false);
      toast.success('Vehicle linked');
    } catch (e) {
      console.error(e);
      toast.error('Could not link vehicle');
    }
  };

  // Local thin wrappers (kept for backward compatibility with component code below if needed)
  // (Removed old formatTime / formatCurrency implementations; using shared utils)

  return (
    <div className="enhanced-payment-verification">
      {/* Header Section */}
      <div className="verification-header">
        <div className="header-content">
          <h2>Payment Verification</h2>
          <p>Verify payments and start wash services</p>
        </div>
        <div className="daily-stats">
          <div className="stat-card">
            <div className="stat-value">{dailyStats.total_verified}</div>
            <div className="stat-label">Verified Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatCurrency(dailyStats.total_amount)}</div>
            <div className="stat-label">Total Amount</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{dailyStats.success_rate.toFixed(1)}%</div>
            <div className="stat-label">Success Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{dailyStats.avg_processing_time}s</div>
            <div className="stat-label">Avg Time</div>
          </div>
        </div>
      </div>

      {/* Verification Methods */}
      <div className="verification-methods">
        <div className="method-tabs">
          <button 
            className={`method-tab ${verificationMethod === 'qr' ? 'active' : ''}`}
            onClick={() => setVerificationMethod('qr')}
            aria-label="QR Scanner verification method"
          >
            📱 QR Scanner
          </button>
          <button 
            className={`method-tab ${verificationMethod === 'manual' ? 'active' : ''}`}
            onClick={() => setVerificationMethod('manual')}
            aria-label="Manual entry verification method"
          >
            🔍 Manual Entry
          </button>
          <button 
            className={`method-tab ${verificationMethod === 'pin' ? 'active' : ''}`}
            onClick={() => setVerificationMethod('pin')}
            aria-label="PIN verification method"
          >
            🔢 PIN Verification
          </button>
        </div>

        <div className="verification-content">
          {verificationMethod === 'qr' && (
            <div className="qr-scanner-section">
              <div className="scanner-container">
                {isScanning ? (
                  <div className="qr-reader-wrapper">
                    <div id="real-qr-reader" style={{ width: '100%', minHeight: 300 }} />
                    <button
                      className="stop-scanning-btn"
                      onClick={() => setIsScanning(false)}
                    >
                      Stop Scanning
                    </button>
                  </div>
                ) : (
                  <div className="scanner-placeholder">
                    <div className="scanner-icon">📱</div>
                    <h3>QR Code Scanner</h3>
                    <p>Position the QR code within the camera view</p>
                    <button
                      className="start-scanning-btn"
                      onClick={() => { setIsScanning(true); startRealScanner(); }}
                    >
                      Start Scanning
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {verificationMethod === 'manual' && (
            <div className="manual-entry-section">
              <div className="manual-form">
                <label htmlFor="manual-ref">Payment Reference</label>
                <input
                  id="manual-ref"
                  type="text"
                  value={manualRef}
                  onChange={(e) => setManualRef(e.target.value)}
                  placeholder="Enter payment reference number"
                  className="manual-input"
                />
                <button 
                  className="verify-btn"
                  onClick={handleManualVerification}
                  disabled={!manualRef || processingPayment}
                >
                  {processingPayment ? 'Verifying...' : 'Verify Payment'}
                </button>
              </div>
            </div>
          )}

          {verificationMethod === 'pin' && (
            <div className="pin-entry-section">
              <div className="pin-form">
                <label htmlFor="manual-pin">Payment PIN</label>
                <input
                  id="manual-pin"
                  type="text"
                  value={manualPin}
                  onChange={(e) => setManualPin(e.target.value)}
                  placeholder="Enter 4-digit payment PIN"
                  className="pin-input"
                  maxLength={4}
                />
                <button 
                  className="verify-btn"
                  onClick={handleManualVerification}
                  disabled={!manualPin || manualPin.length !== 4 || processingPayment}
                >
                  {processingPayment ? 'Verifying...' : 'Verify PIN'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Verification History */}
      <div className="verification-history">
        <div className="history-header">
          <h3>Recent Verifications</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="refresh-btn" onClick={loadVerificationHistory} title="Manual refresh">
              🔄 Refresh
            </button>
            <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <input
                type="checkbox"
                checked={autoRefreshHistory}
                onChange={e => setAutoRefreshHistory(e.target.checked)}
              /> Auto
            </label>
          </div>
        </div>
        <div className="history-list">
          {verificationHistory.slice(0, 10).map(v => {
            const userInfo = v.user ? `${v.user.first_name || ''} ${v.user.last_name || ''} (${v.user.phone || ''})` : '—';
            const vehicleInfo = v.vehicle ? `${v.vehicle.make} ${v.vehicle.model} (${v.vehicle.reg})` : 'No vehicle';
            return (
              <div
                key={`${v.order_id}-${v.timestamp}`}
                className={`history-item ${v.status}`}
                onClick={async () => {
                  // Re-fetch verify-payment for details & open start dialog if not yet started
                  try {
                    const token = localStorage.getItem('token');
                    if (!v.payment_reference) return;
                    const resp = await fetch(`/api/payments/verify-payment?ref=${encodeURIComponent(v.payment_reference)}`, { headers: { Authorization: `Bearer ${token}` } });
                    if (!resp.ok) return;
                    const paymentData: VerifiedPaymentDetails = await resp.json();
                    setSelectedPayment(paymentData);
                    setShowConfirmDialog(true);
                  } catch (e) {
                    console.error('Failed to load verification details', e);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="verification-info">
                  <div className="verification-primary">
                    <span className="order-id">{v.order_id}</span>
                    <span className={`status-badge ${v.status}`}>
                      {v.status === 'success' ? '✅' : '❌'} {v.status.toUpperCase()}
                    </span>
                    {v.started && !v.completed && <span className="status-chip in-progress">In Progress</span>}
                    {v.completed && <span className="status-chip completed">Completed</span>}
                  </div>
                  <div className="verification-details">
                    <span className="user-info">{userInfo}</span>
                    <span className="vehicle-info">{vehicleInfo}</span>
                  </div>
                </div>
                <div className="verification-meta">
                  <div className="amount" title={v.amount != null ? formatCurrency(v.amount) : ''}>{formatCurrency(v.amount || 0)}</div>
                  <div className="timestamp" title={formatDateTime(v.timestamp)}>{formatRelativeTime(v.timestamp)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedPayment && (
        <ConfirmDialog
          isOpen={showConfirmDialog}
          onCancel={() => setShowConfirmDialog(false)}
          onConfirm={confirmStartWash}
          title="Start Wash Service"
          description={`Customer: ${selectedPayment.user?.first_name} ${selectedPayment.user?.last_name} (${selectedPayment.user?.phone}) | Vehicle: ${selectedPayment.vehicle?.make} ${selectedPayment.vehicle?.model} (${selectedPayment.vehicle?.reg}) | Service: ${selectedPayment.service_name}.`}
          confirmLabel={starting ? 'Starting...' : 'Start Wash'}
          cancelLabel="Close"
          loading={starting}
        />
      )}

      {/* Vehicle Association Modal */}
      {showVehicleModal && selectedPayment && (
        <div className="vehicle-modal-overlay">
          <div className="vehicle-modal">
            <h3>Associate Vehicle</h3>
            {selectedPayment.available_vehicles && selectedPayment.available_vehicles.length > 0 && (
              <div className="existing-vehicles">
                <h4>Select Existing</h4>
                <ul>
                  {selectedPayment.available_vehicles.map(v => (
                    <li key={v.id}>
                      <label>
                        <input
                          type="radio"
                          name="vehicleChoice"
                          value={v.id}
                          onChange={() => setLinkingVehicleId(v.id)}
                        /> {v.make} {v.model} ({v.reg})
                      </label>
                    </li>
                  ))}
                </ul>
                <button className="verify-btn" disabled={linkingVehicleId == null} onClick={handleLinkVehicle}>Link Selected Vehicle</button>
              </div>
            )}
            <div className="divider">OR</div>
            <div className="new-vehicle-form">
              <h4>Add New Vehicle</h4>
              <input
                placeholder="Plate"
                value={newVehicle.plate}
                onChange={e => setNewVehicle({ ...newVehicle, plate: e.target.value })}
              />
              <input
                placeholder="Make"
                value={newVehicle.make}
                onChange={e => setNewVehicle({ ...newVehicle, make: e.target.value })}
              />
              <input
                placeholder="Model"
                value={newVehicle.model}
                onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })}
              />
              <button
                className="verify-btn"
                disabled={!newVehicle.plate || !newVehicle.make || !newVehicle.model}
                onClick={handleCreateVehicle}
              >Add & Link Vehicle</button>
            </div>
            <button className="cancel-btn" onClick={() => setShowVehicleModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedPaymentVerification;
