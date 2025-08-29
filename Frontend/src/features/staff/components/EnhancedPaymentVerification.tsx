// src/features/staff/components/EnhancedPaymentVerification.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useActiveWashes } from '../hooks/useActiveWashes';
import { useStartWash } from '../hooks/useStartWash';
import ConfirmDialog from '../../../components/ConfirmDialog';
import './EnhancedPaymentVerification.css';

interface Vehicle {
  id: number;
  reg: string;
  make: string;
  model: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
}

interface PaymentDetails {
  order_id: string;
  user?: User;
  vehicle?: Vehicle;
  payment_pin?: string;
  service_name?: string;
  extras?: string[];
  amount?: number;
  payment_method?: string;
  timestamp?: string;
}

interface VerificationHistory {
  id: string;
  timestamp: string;
  order_id: string;
  status: 'success' | 'failed';
  user_info: string;
  vehicle_info: string;
  payment_method: string;
  amount: number;
}

const EnhancedPaymentVerification: React.FC = () => {
  const [verificationMethod, setVerificationMethod] = useState<'qr' | 'manual' | 'pin'>('qr');
  const [manualRef, setManualRef] = useState('');
  const [manualPin, setManualPin] = useState('');
  const [verificationHistory, setVerificationHistory] = useState<VerificationHistory[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetails | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
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
      const total_amount = successful.reduce((sum, v) => sum + v.amount, 0);
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

  const loadVerificationHistory = useCallback(() => {
    // Mock data for now - in real implementation, this would come from an API
    const mockHistory: VerificationHistory[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        order_id: 'ORD-001',
        status: 'success',
        user_info: 'John Doe (+27 81 234 5678)',
        vehicle_info: 'Toyota Corolla (ABC123GP)',
        payment_method: 'Card',
        amount: 150
      },
      // Add more mock data as needed
    ];
    setVerificationHistory(mockHistory);
  }, []);

  useEffect(() => {
    loadDailyStats();
    loadVerificationHistory();
  }, [loadDailyStats, loadVerificationHistory]);

  const handleQRScan = async (result: { text?: string } | null) => {
    if (result?.text) {
      setIsScanning(false);
      await verifyPayment(result.text);
    }
  };

  const handleManualVerification = async () => {
    if (verificationMethod === 'manual' && manualRef) {
      await verifyPayment(manualRef);
    } else if (verificationMethod === 'pin' && manualPin) {
      await verifyByPin(manualPin);
    }
  };

  const verifyPayment = async (reference: string) => {
    setProcessingPayment(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payments/verify-payment?ref=${reference}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const paymentData = await response.json();
        setSelectedPayment(paymentData);
        setShowConfirmDialog(true);
        
        // Add to verification history
        const newVerification: VerificationHistory = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          order_id: paymentData.order_id,
          status: 'success',
          user_info: `${paymentData.user?.first_name} ${paymentData.user?.last_name} (${paymentData.user?.phone})`,
          vehicle_info: `${paymentData.vehicle?.make} ${paymentData.vehicle?.model} (${paymentData.vehicle?.reg})`,
          payment_method: 'Card',
          amount: paymentData.amount || 0
        };
        
        setVerificationHistory(prev => [newVerification, ...prev]);
        toast.success('Payment verified successfully!');
      } else {
        toast.error('Payment verification failed');
        const failedVerification: VerificationHistory = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          order_id: reference,
          status: 'failed',
          user_info: 'Unknown',
          vehicle_info: 'Unknown',
          payment_method: 'Unknown',
          amount: 0
        };
        setVerificationHistory(prev => [failedVerification, ...prev]);
      }
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
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payments/verify-payment?pin=${pin}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const paymentData = await response.json();
        setSelectedPayment(paymentData);
        setShowConfirmDialog(true);
        toast.success('Payment verified by PIN!');
      } else {
        toast.error('PIN verification failed');
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      toast.error('Error during PIN verification');
    } finally {
      setProcessingPayment(false);
      setManualPin('');
    }
  };

  const confirmStartWash = async () => {
    if (!selectedPayment) return;
    
    try {
      if (!selectedPayment.vehicle?.id) {
        toast.error('No vehicle associated with this payment; cannot start wash.');
        return;
      }
      const washData = {
        orderId: selectedPayment.order_id,
        vehicleId: selectedPayment.vehicle.id
      };
      await startWashMutation.mutateAsync(washData);
      setShowConfirmDialog(false);
      setSelectedPayment(null);
      refetchActiveWashes();
      toast.success('Wash started successfully!');
    } catch (error) {
      console.error('Error starting wash:', error);
      toast.error('Failed to start wash');
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatCurrency = (amount: number) => {
    return `R${amount.toFixed(2)}`;
  };

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
                    <div className="qr-mock-scanner">
                      <p>QR Scanner would be here</p>
                      <button onClick={() => handleQRScan({ text: 'MOCK-QR-123' })}>
                        Simulate QR Scan
                      </button>
                    </div>
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
                      onClick={() => setIsScanning(true)}
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
          <button className="refresh-btn" onClick={loadVerificationHistory}>
            🔄 Refresh
          </button>
        </div>
        <div className="history-list">
          {verificationHistory.slice(0, 10).map((verification) => (
            <div key={verification.id} className={`history-item ${verification.status}`}>
              <div className="verification-info">
                <div className="verification-primary">
                  <span className="order-id">{verification.order_id}</span>
                  <span className={`status-badge ${verification.status}`}>
                    {verification.status === 'success' ? '✅' : '❌'} {verification.status.toUpperCase()}
                  </span>
                </div>
                <div className="verification-details">
                  <span className="user-info">{verification.user_info}</span>
                  <span className="vehicle-info">{verification.vehicle_info}</span>
                </div>
              </div>
              <div className="verification-meta">
                <div className="amount">{formatCurrency(verification.amount)}</div>
                <div className="timestamp">{formatTime(verification.timestamp)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedPayment && (
        <ConfirmDialog
          isOpen={showConfirmDialog}
          onCancel={() => setShowConfirmDialog(false)}
          onConfirm={confirmStartWash}
          title="Start Wash Service"
          description={`Payment Verified Successfully! Customer: ${selectedPayment.user?.first_name} ${selectedPayment.user?.last_name}, Phone: ${selectedPayment.user?.phone}, Vehicle: ${selectedPayment.vehicle?.make} ${selectedPayment.vehicle?.model} (${selectedPayment.vehicle?.reg}), Service: ${selectedPayment.service_name}. Do you want to start the wash service now?`}
          confirmLabel="Start Wash"
          cancelLabel="Cancel"
        />
      )}
    </div>
  );
};

export default EnhancedPaymentVerification;
