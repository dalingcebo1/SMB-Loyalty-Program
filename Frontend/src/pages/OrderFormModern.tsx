import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HiOutlineCheckCircle, 
  HiOutlineChevronRight, 
  HiOutlineChevronLeft,
  HiOutlineClock,
  HiOutlineCreditCard
} from 'react-icons/hi';
import { FaCar, FaSprayCan, FaCheck } from 'react-icons/fa';
import api from '../api/api';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { ToastProvider, useToast } from '../components/ui/Toast';
import { track } from '../utils/analytics';
import './OrderFormModern.css';

interface Service {
  id: number;
  name: string;
  base_price: number;
  description?: string;
  duration?: number;
  loyalty_points?: number;
}

interface Extra {
  id: number;
  name: string;
  price_map: Record<string, number>;
}

interface Vehicle {
  id: number;
  make: string;
  model: string;
  registration: string;
  size?: string;
}

type Step = 1 | 2 | 3 | 4;

const OrderFormModern: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  // Steps
  const [currentStep, setCurrentStep] = useState<Step>(1);
  
  // Form data
  const [services, setServices] = useState<Service[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<number[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [servicesRes, extrasRes, vehiclesRes] = await Promise.all([
          api.get('/services'),
          api.get('/extras'),
          api.get('/vehicles/me')
        ]);
        
        setServices(servicesRes.data);
        setExtras(extrasRes.data);
        setVehicles(vehiclesRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        addToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to load booking data'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    track('page_view', { page: 'OrderFormModern' });
  }, [addToast]);

  // Calculate total
  const calculateTotal = () => {
    if (!selectedService) return 0;
    
    let total = selectedService.base_price;
    
    selectedExtras.forEach(extraId => {
      const extra = extras.find(e => e.id === extraId);
      if (extra && selectedVehicle?.size) {
        total += extra.price_map[selectedVehicle.size] || 0;
      }
    });
    
    return total;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedService || !selectedVehicle) {
      addToast({
        type: 'error',
        title: 'Missing Information',
        message: 'Please complete all required fields'
      });
      return;
    }

    setSubmitting(true);
    
    try {
      const orderData = {
        service_id: selectedService.id,
        vehicle_id: selectedVehicle.id,
        extra_ids: selectedExtras,
        scheduled_date: scheduledDate || undefined,
        scheduled_time: scheduledTime || undefined,
        notes: notes || undefined
      };

      const response = await api.post('/orders', orderData);
      
      addToast({
        type: 'success',
        title: 'Order Created',
        message: 'Your booking has been created successfully!'
      });

      track('order_created', { 
        service_id: selectedService.id,
        total: calculateTotal()
      });

      // Navigate to payment
      navigate(`/payment/${response.data.id}`);
    } catch (error: any) {
      console.error('Error creating order:', error);
      addToast({
        type: 'error',
        title: 'Booking Failed',
        message: error.response?.data?.message || 'Failed to create booking'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Navigation
  const canGoNext = () => {
    switch (currentStep) {
      case 1: return !!selectedService;
      case 2: return true; // Extras are optional
      case 3: return !!selectedVehicle;
      case 4: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (canGoNext() && currentStep < 4) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const goToStep = (step: Step) => {
    setCurrentStep(step);
  };

  if (loading) {
    return (
      <div className="order-form-modern">
        <div className="order-form-modern__loading">
          <Card variant="elevated" padding="lg">
            <div className="text-center">
              <p>Loading booking form...</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="order-form-modern">
      <div className="order-form-modern__container">
        {/* Header */}
        <div className="order-form-modern__header">
          <h1 className="order-form-modern__title">Book a Wash</h1>
          <p className="order-form-modern__subtitle">
            Complete the steps below to book your car wash
          </p>
        </div>

        {/* Step Indicator */}
        <div className="order-form-modern__steps">
          <div className="step-indicator">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`step-indicator__step ${
                  step === currentStep ? 'step-indicator__step--active' : ''
                } ${step < currentStep ? 'step-indicator__step--completed' : ''}`}
                onClick={() => step <= currentStep && goToStep(step as Step)}
              >
                <div className="step-indicator__circle">
                  {step < currentStep ? (
                    <HiOutlineCheckCircle className="step-indicator__check" />
                  ) : (
                    <span>{step}</span>
                  )}
                </div>
                <span className="step-indicator__label">
                  {step === 1 && 'Service'}
                  {step === 2 && 'Extras'}
                  {step === 3 && 'Vehicle'}
                  {step === 4 && 'Review'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="order-form-modern__content"
          >
            {/* Step 1: Select Service */}
            {currentStep === 1 && (
              <div className="order-form-modern__step">
                <h2 className="step-title">Select a Service</h2>
                <div className="service-grid">
                  {services.map((service) => (
                    <Card
                      key={service.id}
                      variant={selectedService?.id === service.id ? 'elevated' : 'outlined'}
                      padding="lg"
                      className={`service-card ${
                        selectedService?.id === service.id ? 'service-card--selected' : ''
                      }`}
                      onClick={() => setSelectedService(service)}
                    >
                      <CardBody>
                        <div className="service-card__content">
                          <div className="service-card__icon">
                            <FaSprayCan />
                          </div>
                          <h3 className="service-card__name">{service.name}</h3>
                          {service.description && (
                            <p className="service-card__description">{service.description}</p>
                          )}
                          <div className="service-card__footer">
                            <span className="service-card__price">
                              R{(service.base_price / 100).toFixed(2)}
                            </span>
                            {service.duration && (
                              <Badge variant="default" size="sm">
                                <HiOutlineClock className="inline mr-1" />
                                {service.duration} min
                              </Badge>
                            )}
                          </div>
                          {service.loyalty_points && (
                            <Badge variant="info" size="sm">
                              +{service.loyalty_points} points
                            </Badge>
                          )}
                        </div>
                      </CardBody>
                      {selectedService?.id === service.id && (
                        <div className="service-card__check">
                          <FaCheck />
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Select Extras */}
            {currentStep === 2 && (
              <div className="order-form-modern__step">
                <h2 className="step-title">Add Extras (Optional)</h2>
                <div className="extras-grid">
                  {extras.map((extra) => {
                    const isSelected = selectedExtras.includes(extra.id);
                    const price = selectedVehicle?.size 
                      ? extra.price_map[selectedVehicle.size] 
                      : Object.values(extra.price_map)[0];
                    
                    return (
                      <Card
                        key={extra.id}
                        variant={isSelected ? 'elevated' : 'outlined'}
                        padding="base"
                        className={`extra-card ${isSelected ? 'extra-card--selected' : ''}`}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedExtras(selectedExtras.filter(id => id !== extra.id));
                          } else {
                            setSelectedExtras([...selectedExtras, extra.id]);
                          }
                        }}
                      >
                        <CardBody>
                          <div className="extra-card__content">
                            <div className="extra-card__header">
                              <h4 className="extra-card__name">{extra.name}</h4>
                              {isSelected && <FaCheck className="extra-card__check" />}
                            </div>
                            <span className="extra-card__price">
                              +R{((price || 0) / 100).toFixed(2)}
                            </span>
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
                {extras.length === 0 && (
                  <Card variant="outlined" padding="lg">
                    <CardBody>
                      <p className="text-center text-muted">No extras available at this time</p>
                    </CardBody>
                  </Card>
                )}
              </div>
            )}

            {/* Step 3: Select Vehicle */}
            {currentStep === 3 && (
              <div className="order-form-modern__step">
                <h2 className="step-title">Select Vehicle</h2>
                <div className="vehicle-grid">
                  {vehicles.map((vehicle) => (
                    <Card
                      key={vehicle.id}
                      variant={selectedVehicle?.id === vehicle.id ? 'elevated' : 'outlined'}
                      padding="lg"
                      className={`vehicle-card ${
                        selectedVehicle?.id === vehicle.id ? 'vehicle-card--selected' : ''
                      }`}
                      onClick={() => setSelectedVehicle(vehicle)}
                    >
                      <CardBody>
                        <div className="vehicle-card__content">
                          <div className="vehicle-card__icon">
                            <FaCar />
                          </div>
                          <h3 className="vehicle-card__name">
                            {vehicle.make} {vehicle.model}
                          </h3>
                          <p className="vehicle-card__reg">{vehicle.registration}</p>
                          {vehicle.size && (
                            <Badge variant="default" size="sm">
                              {vehicle.size}
                            </Badge>
                          )}
                        </div>
                      </CardBody>
                      {selectedVehicle?.id === vehicle.id && (
                        <div className="vehicle-card__check">
                          <FaCheck />
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
                {vehicles.length === 0 && (
                  <Card variant="outlined" padding="lg">
                    <CardBody>
                      <p className="text-center">
                        No vehicles found.{' '}
                        <button 
                          className="link-button"
                          onClick={() => navigate('/account')}
                        >
                          Add a vehicle
                        </button>
                      </p>
                    </CardBody>
                  </Card>
                )}

                {/* Optional Scheduling */}
                <div className="scheduling-section">
                  <h3 className="step-subtitle">Schedule (Optional)</h3>
                  <div className="scheduling-inputs">
                    <Input
                      type="date"
                      label="Preferred Date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      size="base"
                    />
                    <Input
                      type="time"
                      label="Preferred Time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      size="base"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review & Confirm */}
            {currentStep === 4 && (
              <div className="order-form-modern__step">
                <h2 className="step-title">Review Your Booking</h2>
                
                <Card variant="elevated" padding="lg" className="order-summary">
                  <CardHeader>
                    <h3>Order Summary</h3>
                  </CardHeader>
                  <CardBody>
                    <div className="order-summary__section">
                      <h4 className="order-summary__label">Service</h4>
                      <div className="order-summary__item">
                        <span>{selectedService?.name}</span>
                        <span>R{((selectedService?.base_price || 0) / 100).toFixed(2)}</span>
                      </div>
                    </div>

                    {selectedExtras.length > 0 && (
                      <div className="order-summary__section">
                        <h4 className="order-summary__label">Extras</h4>
                        {selectedExtras.map(extraId => {
                          const extra = extras.find(e => e.id === extraId);
                          const price = extra && selectedVehicle?.size 
                            ? extra.price_map[selectedVehicle.size] 
                            : 0;
                          return (
                            <div key={extraId} className="order-summary__item">
                              <span>{extra?.name}</span>
                              <span>R{(price / 100).toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="order-summary__section">
                      <h4 className="order-summary__label">Vehicle</h4>
                      <div className="order-summary__item">
                        <span>
                          {selectedVehicle?.make} {selectedVehicle?.model}
                        </span>
                        <span>{selectedVehicle?.registration}</span>
                      </div>
                    </div>

                    {(scheduledDate || scheduledTime) && (
                      <div className="order-summary__section">
                        <h4 className="order-summary__label">Schedule</h4>
                        <div className="order-summary__item">
                          <HiOutlineClock className="inline mr-2" />
                          <span>
                            {scheduledDate} {scheduledTime}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="order-summary__section">
                      <Input
                        type="textarea"
                        label="Additional Notes (Optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any special instructions..."
                      />
                    </div>

                    <div className="order-summary__total">
                      <span className="order-summary__total-label">Total</span>
                      <span className="order-summary__total-amount">
                        R{(calculateTotal() / 100).toFixed(2)}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="order-form-modern__navigation">
          <Button
            variant="ghost"
            size="lg"
            leftIcon={<HiOutlineChevronLeft />}
            onClick={goBack}
            disabled={currentStep === 1}
          >
            Back
          </Button>

          {currentStep < 4 ? (
            <Button
              variant="primary"
              size="lg"
              rightIcon={<HiOutlineChevronRight />}
              onClick={goNext}
              disabled={!canGoNext()}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="success"
              size="lg"
              rightIcon={<HiOutlineCreditCard />}
              onClick={handleSubmit}
              isLoading={submitting}
              disabled={!selectedService || !selectedVehicle}
            >
              Proceed to Payment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Wrap with ToastProvider
const OrderFormModernWithToast: React.FC = () => (
  <ToastProvider position="top-right">
    <OrderFormModern />
  </ToastProvider>
);

export default OrderFormModernWithToast;
