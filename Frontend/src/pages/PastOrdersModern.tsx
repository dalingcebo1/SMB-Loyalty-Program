import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineSearch,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineX,
  HiOutlineRefresh,
  HiOutlineDocumentText
} from 'react-icons/hi';
import { FaCar, FaSprayCan } from 'react-icons/fa';
import api from '../api/api';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardBody, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { ToastProvider, useToast } from '../components/ui/Toast';
import { track } from '../utils/analytics';
import { formatCurrency } from '../utils/format';
import './PastOrdersModern.css';

interface Order {
  id: number;
  service_name: string;
  total_price: number;
  status: string;
  created_at: string;
  scheduled_date?: string;
  scheduled_time?: string;
  vehicle?: {
    make: string;
    model: string;
    registration: string;
  };
  extras?: { name: string }[];
  loyalty_points?: number;
}

const PastOrdersModern: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchOrders();
    track('page_view', { page: 'PastOrdersModern' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, searchQuery, statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/orders/me');
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load orders'
      });
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => 
        order.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.service_name.toLowerCase().includes(query) ||
        order.vehicle?.registration.toLowerCase().includes(query) ||
        order.id.toString().includes(query)
      );
    }

    setFilteredOrders(filtered);
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const handleReorder = async (order: Order) => {
    try {
      // Navigate to order form with pre-filled data
      navigate('/order', { state: { reorderData: order } });
      
      track('reorder_initiated', { order_id: order.id });
    } catch (error) {
      console.error('Error initiating reorder:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to initiate reorder'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    
    if (statusLower === 'completed' || statusLower === 'paid') {
      return { variant: 'success' as const, label: 'Completed' };
    }
    if (statusLower === 'pending' || statusLower === 'processing') {
      return { variant: 'warning' as const, label: 'Pending' };
    }
    if (statusLower === 'cancelled' || statusLower === 'failed') {
      return { variant: 'error' as const, label: 'Cancelled' };
    }
    return { variant: 'default' as const, label: status };
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase();
    
    if (statusLower === 'completed' || statusLower === 'paid') {
      return <HiOutlineCheckCircle />;
    }
    if (statusLower === 'pending' || statusLower === 'processing') {
      return <HiOutlineClock />;
    }
    if (statusLower === 'cancelled' || statusLower === 'failed') {
      return <HiOutlineX />;
    }
    return <HiOutlineClock />;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="past-orders-modern">
        <div className="past-orders-modern__container">
          <Card variant="elevated" padding="lg">
            <div className="text-center py-8">
              <p>Loading your orders...</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="past-orders-modern">
      <div className="past-orders-modern__container">
        {/* Header */}
        <div className="past-orders-modern__header">
          <div>
            <h1 className="past-orders-modern__title">Order History</h1>
            <p className="past-orders-modern__subtitle">
              View and manage your past bookings
            </p>
          </div>
          <Button
            variant="ghost"
            size="base"
            leftIcon={<HiOutlineRefresh />}
            onClick={fetchOrders}
          >
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card variant="outlined" padding="base" className="filters-card">
          <div className="filters">
            <div className="filters__search">
              <Input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<HiOutlineSearch />}
              />
            </div>

            <div className="filters__status">
              <div className="status-buttons">
                <button
                  className={`status-button ${statusFilter === 'all' ? 'status-button--active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </button>
                <button
                  className={`status-button ${statusFilter === 'completed' ? 'status-button--active' : ''}`}
                  onClick={() => setStatusFilter('completed')}
                >
                  Completed
                </button>
                <button
                  className={`status-button ${statusFilter === 'pending' ? 'status-button--active' : ''}`}
                  onClick={() => setStatusFilter('pending')}
                >
                  Pending
                </button>
                <button
                  className={`status-button ${statusFilter === 'cancelled' ? 'status-button--active' : ''}`}
                  onClick={() => setStatusFilter('cancelled')}
                >
                  Cancelled
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Orders Timeline */}
        {filteredOrders.length > 0 ? (
          <div className="orders-timeline">
            <AnimatePresence>
              {filteredOrders.map((order, index) => {
                const statusBadge = getStatusBadge(order.status);
                
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="timeline-item"
                  >
                    <div className="timeline-item__marker">
                      <div className={`timeline-item__icon timeline-item__icon--${statusBadge.variant}`}>
                        {getStatusIcon(order.status)}
                      </div>
                      {index < filteredOrders.length - 1 && (
                        <div className="timeline-item__line" />
                      )}
                    </div>

                    <Card variant="outlined" padding="lg" className="order-card">
                      <CardHeader>
                        <div className="order-card__header">
                          <div className="order-card__title-section">
                            <h3 className="order-card__title">{order.service_name}</h3>
                            <p className="order-card__date">{formatDate(order.created_at)}</p>
                          </div>
                          <Badge variant={statusBadge.variant} size="base">
                            {statusBadge.label}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardBody>
                        <div className="order-card__details">
                          {order.vehicle && (
                            <div className="order-card__detail">
                              <FaCar className="order-card__detail-icon" />
                              <span>
                                {order.vehicle.make} {order.vehicle.model} ({order.vehicle.registration})
                              </span>
                            </div>
                          )}

                          {order.extras && order.extras.length > 0 && (
                            <div className="order-card__detail">
                              <FaSprayCan className="order-card__detail-icon" />
                              <span>
                                {order.extras.map(e => e.name).join(', ')}
                              </span>
                            </div>
                          )}

                          {order.scheduled_date && (
                            <div className="order-card__detail">
                              <HiOutlineClock className="order-card__detail-icon" />
                              <span>
                                Scheduled: {order.scheduled_date} {order.scheduled_time}
                              </span>
                            </div>
                          )}

                          <div className="order-card__price">
                            <span className="order-card__price-label">Total:</span>
                            <span className="order-card__price-value">
                              {formatCurrency(order.total_price)}
                            </span>
                          </div>

                          {order.loyalty_points && (
                            <div className="order-card__loyalty">
                              <Badge variant="info" size="sm">
                                +{order.loyalty_points} points earned
                              </Badge>
                            </div>
                          )}
                        </div>
                      </CardBody>

                      <CardFooter>
                        <div className="order-card__actions">
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<HiOutlineDocumentText />}
                            onClick={() => handleViewDetails(order)}
                          >
                            View Details
                          </Button>
                          
                          {(order.status.toLowerCase() === 'completed' || 
                            order.status.toLowerCase() === 'paid') && (
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<HiOutlineRefresh />}
                              onClick={() => handleReorder(order)}
                            >
                              Reorder
                            </Button>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState
            icon={<HiOutlineDocumentText />}
            title={searchQuery || statusFilter !== 'all' ? 'No Orders Found' : 'No Orders Yet'}
            description={
              searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Book your first car wash to get started'
            }
            action={
              searchQuery || statusFilter !== 'all' ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              ) : (
                <Button variant="primary" onClick={() => navigate('/order')}>
                  Book a Wash
                </Button>
              )
            }
          />
        )}

        {/* Order Details Modal */}
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title="Order Details"
          size="lg"
        >
          {selectedOrder && (
            <div className="order-details">
              <div className="order-details__header">
                <h3 className="order-details__title">{selectedOrder.service_name}</h3>
                <Badge variant={getStatusBadge(selectedOrder.status).variant}>
                  {getStatusBadge(selectedOrder.status).label}
                </Badge>
              </div>

              <div className="order-details__section">
                <h4 className="order-details__section-title">Order Information</h4>
                <div className="order-details__info">
                  <div className="order-details__info-item">
                    <span className="order-details__info-label">Order ID:</span>
                    <span className="order-details__info-value">#{selectedOrder.id}</span>
                  </div>
                  <div className="order-details__info-item">
                    <span className="order-details__info-label">Date:</span>
                    <span className="order-details__info-value">
                      {formatDate(selectedOrder.created_at)}
                    </span>
                  </div>
                  {selectedOrder.scheduled_date && (
                    <div className="order-details__info-item">
                      <span className="order-details__info-label">Scheduled:</span>
                      <span className="order-details__info-value">
                        {selectedOrder.scheduled_date} {selectedOrder.scheduled_time}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {selectedOrder.vehicle && (
                <div className="order-details__section">
                  <h4 className="order-details__section-title">Vehicle</h4>
                  <div className="order-details__vehicle">
                    <FaCar className="order-details__vehicle-icon" />
                    <div>
                      <p className="order-details__vehicle-name">
                        {selectedOrder.vehicle.make} {selectedOrder.vehicle.model}
                      </p>
                      <p className="order-details__vehicle-reg">
                        {selectedOrder.vehicle.registration}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="order-details__section">
                <h4 className="order-details__section-title">Services</h4>
                <div className="order-details__services">
                  <div className="order-details__service-item">
                    <span>{selectedOrder.service_name}</span>
                  </div>
                  {selectedOrder.extras && selectedOrder.extras.map((extra, idx) => (
                    <div key={idx} className="order-details__service-item">
                      <span>+ {extra.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="order-details__section">
                <div className="order-details__total">
                  <span className="order-details__total-label">Total Amount:</span>
                  <span className="order-details__total-value">
                    {formatCurrency(selectedOrder.total_price)}
                  </span>
                </div>
                {selectedOrder.loyalty_points && (
                  <div className="order-details__loyalty">
                    <Badge variant="info">
                      +{selectedOrder.loyalty_points} loyalty points
                    </Badge>
                  </div>
                )}
              </div>

              <div className="order-details__actions">
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setShowDetailsModal(false)}
                >
                  Close
                </Button>
                {(selectedOrder.status.toLowerCase() === 'completed' || 
                  selectedOrder.status.toLowerCase() === 'paid') && (
                  <Button
                    variant="primary"
                    size="lg"
                    leftIcon={<HiOutlineRefresh />}
                    onClick={() => {
                      handleReorder(selectedOrder);
                      setShowDetailsModal(false);
                    }}
                  >
                    Reorder
                  </Button>
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

// Wrap with ToastProvider
const PastOrdersModernWithToast: React.FC = () => (
  <ToastProvider position="top-right">
    <PastOrdersModern />
  </ToastProvider>
);

export default PastOrdersModernWithToast;
