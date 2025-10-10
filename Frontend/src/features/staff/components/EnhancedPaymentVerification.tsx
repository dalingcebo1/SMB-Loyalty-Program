// src/features/staff/components/EnhancedPaymentVerification.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../api/api';
import { useActiveWashes } from '../hooks/useActiveWashes';
import { useStartWash } from '../hooks/useStartWash';
import { useRecentVerifications, useVerifyPayment, VerifiedPaymentDetails, VerificationRecord } from '../hooks/usePaymentVerification';
import ConfirmDialog from '../../../components/ConfirmDialog';
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
  // Backend provides amounts in cents (Payment.amount / Order.amount stored as integer cents)
      interface ExtendedRecord extends VerificationRecord { amount_cents?: number }
      const total_amount_cents = (successful as ExtendedRecord[]).reduce((sum, v) => {
        const cents = (typeof v.amount_cents === 'number' ? v.amount_cents : v.amount) || 0;
        return sum + cents;
      }, 0);
  const total_amount = total_amount_cents / 100; // convert to rands for display
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
      const resp = await api.post(`/users/${selectedPayment.user.id}/vehicles`, {
        plate: newVehicle.plate,
        make: newVehicle.make,
        model: newVehicle.model,
      });
      const veh = resp.data;
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Payment Verification</h2>
              <p className="text-sm text-gray-500">Verify payments and start wash services</p>
            </div>
          </div>
          
          {/* Daily Stats */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-lg font-semibold text-blue-700">{dailyStats.total_verified}</span>
              <span className="text-sm text-blue-600">Verified Today</span>
            </div>
            <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
              <span className="text-lg font-semibold text-green-700">{formatCurrency(dailyStats.total_amount)}</span>
              <span className="text-sm text-green-600">Total Amount</span>
            </div>
            <div className="flex items-center space-x-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
              <span className="text-lg font-semibold text-purple-700">{dailyStats.success_rate.toFixed(1)}%</span>
              <span className="text-sm text-purple-600">Success Rate</span>
            </div>
            <div className="flex items-center space-x-2 px-3 py-2 bg-orange-50 rounded-lg border border-orange-200">
              <span className="text-lg font-semibold text-orange-700">{dailyStats.avg_processing_time}s</span>
              <span className="text-sm text-orange-600">Avg Time</span>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Methods */}
      <div className="p-6">
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button 
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                verificationMethod === 'qr' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setVerificationMethod('qr')}
              aria-label="QR Scanner verification method"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zm2 2V5h1v1h-1zM11 4a1 1 0 100-2 1 1 0 000 2zM11 7a1 1 0 100-2 1 1 0 000 2zM11 10a1 1 0 100-2 1 1 0 000 2zM11 13a1 1 0 100-2 1 1 0 000 2zM11 16a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>QR Scanner</span>
            </button>
            <button 
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                verificationMethod === 'manual' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setVerificationMethod('manual')}
              aria-label="Manual entry verification method"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
              </svg>
              <span>Manual Entry</span>
            </button>
            <button 
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                verificationMethod === 'pin' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setVerificationMethod('pin')}
              aria-label="PIN verification method"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
              </svg>
              <span>PIN Verification</span>
            </button>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-6 min-h-96">
          {verificationMethod === 'qr' && (
            <div className="flex justify-center items-center h-full">
              <div className="w-full max-w-md">
                {isScanning ? (
                  <div className="relative">
                    <div className="border-2 border-blue-500 rounded-xl overflow-hidden">
                      <div id="real-qr-reader" style={{ width: '100%', minHeight: 300 }} />
                    </div>
                    <button
                      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                      onClick={() => setIsScanning(false)}
                    >
                      Stop Scanning
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="mx-auto w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zm2 2V5h1v1h-1zM11 4a1 1 0 100-2 1 1 0 000 2zM11 7a1 1 0 100-2 1 1 0 000 2zM11 10a1 1 0 100-2 1 1 0 000 2zM11 13a1 1 0 100-2 1 1 0 000 2zM11 16a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">QR Code Scanner</h3>
                    <p className="text-gray-500 mb-6">Position the QR code within the camera view</p>
                    <button
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
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
            <div className="max-w-md mx-auto">
              <div className="space-y-4">
                <div>
                  <label htmlFor="manual-ref" className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Reference
                  </label>
                  <input
                    id="manual-ref"
                    type="text"
                    value={manualRef}
                    onChange={(e) => setManualRef(e.target.value)}
                    placeholder="Enter payment reference number"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button 
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleManualVerification}
                  disabled={!manualRef || processingPayment}
                >
                  {processingPayment ? 'Verifying...' : 'Verify Payment'}
                </button>
              </div>
            </div>
          )}

          {verificationMethod === 'pin' && (
            <div className="max-w-md mx-auto">
              <div className="space-y-4">
                <div>
                  <label htmlFor="manual-pin" className="block text-sm font-medium text-gray-700 mb-2">
                    Payment PIN
                  </label>
                  <input
                    id="manual-pin"
                    type="text"
                    value={manualPin}
                    onChange={(e) => setManualPin(e.target.value)}
                    placeholder="Enter 4-digit payment PIN"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg"
                    maxLength={4}
                  />
                </div>
                <button 
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="border-t border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Recent Verifications</h3>
                <p className="text-sm text-gray-500">Latest payment verification activity</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={loadVerificationHistory}
                title="Manual refresh"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Refresh
              </button>
              <label className="flex items-center space-x-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={autoRefreshHistory}
                  onChange={e => setAutoRefreshHistory(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Auto</span>
              </label>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="space-y-3">
            {verificationHistory.slice(0, 10).map(v => {
              const userInfo = v.user ? `${v.user.first_name || ''} ${v.user.last_name || ''} (${v.user.phone || ''})` : '—';
              const vehicleInfo = v.vehicle ? `${v.vehicle.make} ${v.vehicle.model} (${v.vehicle.reg})` : 'No vehicle';
              const amountCents = (v as { amount_cents?: number }).amount_cents ?? v.amount ?? 0;
              return (
                <div
                  key={`${v.order_id}-${v.timestamp}`}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={async () => {
                    // Re-fetch verify-payment for details & open start dialog if not yet started
                    try {
                      if (!v.payment_reference) return;
                      const resp = await api.get('/payments/verify-payment', {
                        params: { ref: v.payment_reference },
                      });
                      const paymentData: VerifiedPaymentDetails = resp.data;
                      setSelectedPayment(paymentData);
                      setShowConfirmDialog(true);
                    } catch (e) {
                      console.error('Failed to load verification details', e);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="font-medium text-gray-900">{v.order_id}</span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          v.status === 'success' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {v.status === 'success' ? (
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                          {v.status.toUpperCase()}
                        </span>
                        {v.started && !v.completed && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            In Progress
                          </span>
                        )}
                        {v.completed && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Completed
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                          </svg>
                          <span>{userInfo}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>{vehicleInfo}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 mb-1">
                        {formatCurrency(amountCents / 100)}
                      </div>
                      <div className="text-sm text-gray-500" title={formatDateTime(v.timestamp)}>
                        {formatRelativeTime(v.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Associate Vehicle</h3>
                <button
                  onClick={() => setShowVehicleModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {selectedPayment.available_vehicles && selectedPayment.available_vehicles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Select Existing Vehicle</h4>
                  <div className="space-y-2">
                    {selectedPayment.available_vehicles.map(v => (
                      <label key={v.id} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name="vehicleChoice"
                          value={v.id}
                          onChange={() => setLinkingVehicleId(v.id)}
                          className="mr-3 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-gray-900">{v.make} {v.model} ({v.reg})</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button 
                    className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={linkingVehicleId == null} 
                    onClick={handleLinkVehicle}
                  >
                    Link Selected Vehicle
                  </button>
                </div>
              )}
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">OR</span>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Add New Vehicle</h4>
                <div className="space-y-3">
                  <input
                    placeholder="License Plate"
                    value={newVehicle.plate}
                    onChange={e => setNewVehicle({ ...newVehicle, plate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    placeholder="Make (e.g., Toyota)"
                    value={newVehicle.make}
                    onChange={e => setNewVehicle({ ...newVehicle, make: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    placeholder="Model (e.g., Camry)"
                    value={newVehicle.model}
                    onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!newVehicle.plate || !newVehicle.make || !newVehicle.model}
                    onClick={handleCreateVehicle}
                  >
                    Add & Link Vehicle
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedPaymentVerification;
