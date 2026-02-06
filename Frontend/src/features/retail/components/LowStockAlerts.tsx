import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../api/api';
import { FaExclamationTriangle, FaCheck, FaBox } from 'react-icons/fa';
import './LowStockAlerts.css';

interface LowStockAlert {
  id: number;
  product: {
    id: number;
    sku: string;
    name: string;
    category?: {
      name: string;
    };
  };
  inventory_level: {
    location: string;
  };
  threshold: number;
  current_quantity: number;
  is_acknowledged: boolean;
  acknowledged_at?: string;
  created_at: string;
}

export const LowStockAlerts: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery<LowStockAlert[]>({
    queryKey: ['low-stock-alerts'],
    queryFn: async () => {
      const response = await api.get('/api/retail/stock/low-alerts');
      return response.data;
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: number) => {
      await api.post(`/api/retail/stock/low-alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['low-stock-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    },
  });

  const handleAcknowledge = async (alertId: number) => {
    await acknowledgeMutation.mutateAsync(alertId);
  };

  if (isLoading) {
    return (
      <div className="alerts-loading">
        <div className="spinner-small"></div>
        <span>Loading alerts...</span>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="alerts-empty">
        <FaCheck className="empty-icon" />
        <span>All stock levels are good!</span>
      </div>
    );
  }

  const unacknowledged = alerts.filter(a => !a.is_acknowledged);
  const acknowledged = alerts.filter(a => a.is_acknowledged);

  return (
    <div className="low-stock-alerts">
      <div className="alerts-header">
        <div className="alerts-title">
          <FaExclamationTriangle className="title-icon" />
          <h3>Low Stock Alerts</h3>
          <span className="alert-count">{unacknowledged.length}</span>
        </div>
      </div>

      <div className="alerts-list">
        {unacknowledged.length > 0 && (
          <div className="alerts-section">
            <h4 className="section-title">Urgent</h4>
            {unacknowledged.map(alert => (
              <div key={alert.id} className="alert-item urgent">
                <div className="alert-icon">
                  <FaBox />
                </div>
                <div className="alert-content">
                  <div className="alert-product">
                    <strong>{alert.product.name}</strong>
                    <code className="alert-sku">{alert.product.sku}</code>
                  </div>
                  <div className="alert-details">
                    <span className="alert-stock">
                      {alert.current_quantity} / {alert.threshold} units
                    </span>
                    {alert.product.category && (
                      <span className="alert-category">{alert.product.category.name}</span>
                    )}
                    <span className="alert-location">{alert.inventory_level.location}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleAcknowledge(alert.id)}
                  className="btn-acknowledge"
                  disabled={acknowledgeMutation.isPending}
                  title="Mark as acknowledged"
                >
                  <FaCheck />
                </button>
              </div>
            ))}
          </div>
        )}

        {acknowledged.length > 0 && (
          <div className="alerts-section">
            <h4 className="section-title">Acknowledged</h4>
            {acknowledged.map(alert => (
              <div key={alert.id} className="alert-item acknowledged">
                <div className="alert-icon">
                  <FaCheck />
                </div>
                <div className="alert-content">
                  <div className="alert-product">
                    <strong>{alert.product.name}</strong>
                    <code className="alert-sku">{alert.product.sku}</code>
                  </div>
                  <div className="alert-details">
                    <span className="alert-stock">
                      {alert.current_quantity} / {alert.threshold} units
                    </span>
                    {alert.product.category && (
                      <span className="alert-category">{alert.product.category.name}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
