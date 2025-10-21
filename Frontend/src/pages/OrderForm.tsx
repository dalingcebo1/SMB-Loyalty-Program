import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api/api";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import { useAuth } from "../auth/AuthProvider";
import StepIndicator from "../components/StepIndicator";
import ServiceCard from "../components/ServiceCard";
import DateTimePicker from "../components/DateTimePicker";
import { track } from '../utils/analytics';
import './OrderForm.css';
import '../styles/shared-buttons.css';

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


const OrderForm: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Clear any previous pending order to avoid auto-redirect to payment skeleton
  useEffect(() => {
    localStorage.removeItem('pendingOrder');
  }, []);

  // Analytics: page view of OrderForm
  useEffect(() => {
    track('page_view', { page: 'OrderForm' });
  }, []);

  useEffect(() => {
    // Only auto-redirect on the Order page itself, not on '/services'
    if (location.pathname === '/order' && !location.state) {
      const pending = localStorage.getItem('pendingOrder');
      if (pending) {
        const state = JSON.parse(pending);
        navigate('/order/payment', { state, replace: true });
      }
    }
  }, [location.pathname, location.state, navigate]);

  // Helper functions for enhanced service data
  const getServiceDescription = (name: string): string => {
    const descriptions: Record<string, string> = {
      'FULL HOUSE': 'Complete interior and exterior cleaning with premium products',
      'Basic Wash': 'Standard exterior wash with soap and rinse',
      'Deluxe Wash': 'Premium wash with wax and interior vacuum',
      'Premium Detail': 'Full detailing service with clay bar and protection'
    };
    return descriptions[name] || 'Professional car wash service';
  };

  const getServiceDuration = (name: string): number => {
    const durations: Record<string, number> = {
      'FULL HOUSE': 60,
      'Basic Wash': 20,
      'Deluxe Wash': 35,
      'Premium Detail': 90
    };
    return durations[name] || 30;
  };

  // Fetch catalog data
  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: async (): Promise<Record<string, Service[]>> => {
      const { data } = await api.get("/catalog/services");
      // Add mock data for better UX
      const enhancedData: Record<string, Service[]> = {};
      Object.entries(data).forEach(([category, services]) => {
        enhancedData[category] = (services as Service[]).map(service => ({
          ...service,
          description: getServiceDescription(service.name),
          duration: getServiceDuration(service.name),
          loyalty_points: Math.floor(service.base_price / 10) // 1 point per R10
        }));
      });
      return enhancedData;
    },
    staleTime: 1000 * 60 * 5,
  });

  const extrasQuery = useQuery({
    queryKey: ["extras"],
    queryFn: async (): Promise<Extra[]> => {
      const { data: raw } = await api.get<Extra[]>("/catalog/extras");
      return Array.from(new Map(raw.map((e) => [e.id, e])).values());
    },
    staleTime: 1000 * 60 * 5,
  });

  // Error toast helpers
  useEffect(() => { if (servicesQuery.error) toast.error("Failed to load services"); },
    [servicesQuery.error]);
  useEffect(() => { if (extrasQuery.error) toast.error("Failed to load extras"); },
    [extrasQuery.error]);

  // Type-safe fall-backs with useMemo for dependency optimization
  const servicesByCategory = useMemo(() => servicesQuery.data ?? {}, [servicesQuery.data]);
  const extras = useMemo(() => extrasQuery.data ?? [], [extrasQuery.data]);

  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [extraQuantities, setExtraQuantities] = useState<Record<number, number>>({});
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Removed confirmation modal state

  // Set default category to "Fullhouse" (case-insensitive) when services load
  useEffect(() => {
    const cats = Object.keys(servicesByCategory);
    if (cats.length) {
      // Try to find "Fullhouse" (case-insensitive)
      const fullhouseCat =
        cats.find((c) => c.trim().toLowerCase() === "fullhouse") ||
        cats.find((c) => c.trim().toLowerCase() === "full house");
      if (fullhouseCat) {
        setSelectedCategory(fullhouseCat);
      } else if (!selectedCategory || !cats.includes(selectedCategory)) {
        setSelectedCategory(cats[0]);
      }
    }
  }, [servicesByCategory, selectedCategory]);

  // Set default service when category changes
  useEffect(() => {
    if (selectedCategory && servicesByCategory[selectedCategory]?.length) {
      const serviceList = servicesByCategory[selectedCategory];
      // Try to find "FULL HOUSE" (case-insensitive)
      const fullHouseService = serviceList.find(
        (s) => s.name.trim().toLowerCase() === "full house"
      );
      if (!selectedService || !serviceList.some((s) => s.id === selectedService.id)) {
        setSelectedService(fullHouseService ?? serviceList[0] ?? null);
        setServiceQuantity(1);
      }
    }
  }, [selectedCategory, servicesByCategory, selectedService]);

  // Init extra counters
  useEffect(() => {
    const init: Record<number, number> = {};
    extras.forEach((e) => (init[e.id] = 0));
    setExtraQuantities(init);
  }, [extras]);

  // Calculate total
  const total = useMemo(() => {
    let sum = 0;
    if (selectedService) {
      sum += selectedService.base_price * serviceQuantity;
    }
    extras.forEach((e) => {
      const qty = extraQuantities[e.id] || 0;
      if (qty > 0 && selectedCategory) {
        sum += (e.price_map[selectedCategory] ?? 0) * qty;
      }
    });
    return sum;
  }, [selectedService, serviceQuantity, extraQuantities, extras, selectedCategory]);

  // Compute order summary
  const orderSummary = useMemo(() => {
    const lines: string[] = [];
    if (selectedService) {
      lines.push(`${selectedService.name} × ${serviceQuantity}`);
    }
    extras.forEach(e => {
      const qty = extraQuantities[e.id] || 0;
      if (qty > 0) {
        const name = e.name || `Extra ${e.id}`;
        lines.push(`${name} × ${qty}`);
      }
    });
    return lines;
  }, [selectedService, serviceQuantity, extras, extraQuantities]);

  // Step navigation
  const canProceedToStep2 = selectedService && selectedCategory;
  const canProceedToStep3 = canProceedToStep2 && selectedDate && selectedTime;

  const handleNextStep = () => {
    if (currentStep === 1 && canProceedToStep2) {
      setCurrentStep(2);
      track('step_completed', { step: 1, page: 'OrderForm' });
    } else if (currentStep === 2 && canProceedToStep3) {
      setCurrentStep(3);
      track('step_completed', { step: 2, page: 'OrderForm' });
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Submit order
  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime) {
      toast.warning("Please complete all steps before booking");
      return;
    }

    track('cta_click', { label: 'Confirm Booking', page: 'OrderForm' });
    setIsSubmitting(true);

    const payload = {
      email: user!.email,
      service_id: selectedService.id,
      quantity: serviceQuantity,
      scheduled_date: selectedDate,
      scheduled_time: selectedTime,
      extras: Object.entries(extraQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ id: Number(id), quantity: qty })),
    };

    try {
      const res = await api.post("/orders/create", payload);
      const { order_id, qr_data } = res.data;

      const paymentState = {
        orderId: order_id,
        qrData: qr_data,
        total: total * 100,
        summary: orderSummary,
        timestamp: Date.now(),
        serviceName: selectedService.name,
        quantity: serviceQuantity,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime
      };

      localStorage.setItem('pendingOrder', JSON.stringify(paymentState));
      toast.success("Booking confirmed! Redirecting to payment...");
      navigate('/order/payment', { state: paymentState });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error.response?.data?.detail || "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateTimeChange = (date: string, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
  };

  // Confirmation modal removed; direct navigation implemented.

  // Show auth loading and block anonymous users
  if (loading) return <Loading text="Authenticating..." />;
  if (servicesQuery.isLoading || extrasQuery.isLoading) {
    return <Loading text="Loading catalog..." />;
  }
  if (servicesQuery.error || extrasQuery.error) {
    return (
      <ErrorMessage
        message={
          (servicesQuery.error as Error)?.message || (extrasQuery.error as Error)?.message || 'Error loading data'
        }
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="order-form-page user-page">
      <ToastContainer position="top-right" />
      
      {/* Hero Section */}
      <section className="user-hero">
        <span className="user-hero__eyebrow">Booking</span>
        <h1 className="user-hero__title">Book Your Service</h1>
        <p className="user-hero__subtitle">Select your service, choose a time, and we'll take care of the rest</p>
      </section>

      {/* Step Indicator */}
      <section className="user-page__section">
        <div className="order-step-indicator">
          <StepIndicator 
            currentStep={currentStep}
            stepsCompleted={currentStep > 1 ? [1] : []}
          />
        </div>
      </section>

      {/* Step Content */}
      <section className="user-page__section">
        <AnimatePresence mode="wait">
          {/* Step 1: Service Selection */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="form-step surface-card"
                >
                  <div className="card-header">
                    <h2 className="section-title">Step 1: Select Your Service</h2>
                  </div>
                  
                  {/* Category Selection */}
                  <div className="category-tabs">
                    {Object.keys(servicesByCategory).map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`category-tab ${
                          selectedCategory === category ? 'active' : ''
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>

                  {/* Service Cards */}
                  {selectedCategory && (
                    <div className="services-grid">
                      {servicesByCategory[selectedCategory]?.map((service) => (
                        <ServiceCard
                          key={service.id}
                          service={service}
                          isSelected={selectedService?.id === service.id}
                          onSelect={setSelectedService}
                          quantity={selectedService?.id === service.id ? serviceQuantity : 1}
                          onQuantityChange={setServiceQuantity}
                        />
                      ))}
                    </div>
                  )}

                  {/* Extras */}
                  {extras.length > 0 && selectedCategory && (
                    <div className="extras-grid">
                      {extras.map((extra) => (
                        <div key={extra.id} className="extra-item">
                          <div className="extra-header">
                            <h4>{extra.name}</h4>
                            <span className="extra-price">
                              +R{extra.price_map[selectedCategory] ?? 0}
                            </span>
                          </div>
                          <div className="extra-quantity">
                            <button
                              type="button"
                              onClick={() => setExtraQuantities(prev => ({ 
                                ...prev, 
                                [extra.id]: Math.max(0, (prev[extra.id] || 0) - 1) 
                              }))}
                              className="quantity-button"
                              disabled={(extraQuantities[extra.id] || 0) === 0}
                            >
                              −
                            </button>
                            <span className="quantity-display">{extraQuantities[extra.id] || 0}</span>
                            <button
                              type="button"
                              onClick={() => setExtraQuantities(prev => ({ 
                                ...prev, 
                                [extra.id]: (prev[extra.id] || 0) + 1 
                              }))}
                              className="quantity-button"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step 1 Actions */}
                  <div className="form-actions">
                    <div className="total-amount">
                      Total: R{total}
                    </div>
                    <button
                      onClick={handleNextStep}
                      disabled={!canProceedToStep2}
                      className={`action-button ${canProceedToStep2 ? 'primary' : 'secondary'}`}
                    >
                      Choose Date & Time
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Date & Time Selection */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="form-step surface-card"
                >
                  <div className="card-header">
                    <h2 className="section-title">Step 2: Choose Date & Time</h2>
                  </div>
                  
                  <DateTimePicker
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                    onDateTimeChange={handleDateTimeChange}
                    className="datetime-section"
                  />

                  {/* Step 2 Actions */}
                  <div className="form-actions">
                    <button
                      onClick={handlePrevStep}
                      className="action-button secondary"
                    >
                      Back
                    </button>
                    <div className="total-amount">
                      Total: R{total}
                    </div>
                    <button
                      onClick={handleNextStep}
                      disabled={!canProceedToStep3}
                      className={`action-button ${canProceedToStep3 ? 'primary' : 'secondary'}`}
                    >
                      Review Booking
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Review & Confirm */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="form-step surface-card"
                >
                  <div className="card-header">
                    <h2 className="section-title">Step 3: Review Your Booking</h2>
                  </div>
                  
                  {/* Order Summary */}
                  <div className="order-summary">
                    <h3 className="summary-title">Booking Summary</h3>
                    
                    <div className="summary-item">
                      <span>Service:</span>
                      <span>{selectedService?.name}</span>
                    </div>
                    <div className="summary-item">
                      <span>Quantity:</span>
                      <span>{serviceQuantity}</span>
                    </div>
                    <div className="summary-item">
                      <span>Date:</span>
                      <span>{new Date(selectedDate).toLocaleDateString()}</span>
                    </div>
                    <div className="summary-item">
                      <span>Time:</span>
                      <span>{selectedTime}</span>
                    </div>
                    <div className="summary-item">
                      <span>Duration:</span>
                      <span>~{selectedService?.duration || 30} min</span>
                    </div>
                    
                    {/* Price Breakdown */}
                    <div className="summary-item">
                      <span>{selectedService?.name} × {serviceQuantity}</span>
                      <span>R{selectedService ? selectedService.base_price * serviceQuantity : 0}</span>
                    </div>
                    
                    {extras.map(extra => {
                      const qty = extraQuantities[extra.id] || 0;
                      if (qty > 0) {
                        const price = (extra.price_map[selectedCategory] ?? 0) * qty;
                        return (
                          <div key={extra.id} className="summary-item">
                            <span>{extra.name} × {qty}</span>
                            <span>R{price}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                    
                    <div className="summary-total">
                      <span>Total:</span>
                      <span className="total-amount">R{total}</span>
                    </div>
                  </div>

                  {/* Step 3 Actions */}
                  <div className="form-actions">
                    <button
                      onClick={handlePrevStep}
                      className="action-button secondary"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={`action-button ${isSubmitting ? 'secondary' : 'primary'}`}
                    >
                      {isSubmitting ? 'Confirming...' : 'Confirm Booking'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
      </section>
    </div>
  );
};

export default OrderForm;
