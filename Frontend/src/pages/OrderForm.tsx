import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api/api";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import { useAuth } from "../auth/AuthProvider";
import PageLayout from "../components/PageLayout";
import StepIndicator from "../components/StepIndicator";
import ServiceCard from "../components/ServiceCard";
import DateTimePicker from "../components/DateTimePicker";
import BookingConfirmation from "../components/BookingConfirmation";
import { track } from '../utils/analytics';

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

interface ConfirmedOrder {
  id: string;
  serviceName: string;
  date: string;
  time: string;
  total: number;
  estimatedDuration?: number;
  bayNumber: number;
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
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);

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

      const orderDetails = {
        id: order_id,
        serviceName: selectedService.name,
        date: selectedDate,
        time: selectedTime,
        total,
        estimatedDuration: selectedService.duration,
        bayNumber: Math.floor(Math.random() * 5) + 1 // Mock bay assignment
      };

      setConfirmedOrder(orderDetails);
      setShowConfirmation(true);
      
      // Store for payment flow
      const paymentState = {
        orderId: order_id,
        qrData: qr_data,
        total: total * 100,
        summary: orderSummary,
        timestamp: Date.now(),
      };
      localStorage.setItem('pendingOrder', JSON.stringify(paymentState));
      
      toast.success("Booking confirmed!");
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

  const handleConfirmationComplete = () => {
    setShowConfirmation(false);
    if (confirmedOrder) {
      navigate("/order/payment", { 
        state: JSON.parse(localStorage.getItem('pendingOrder') || '{}')
      });
    }
  };

  // Show auth loading and block anonymous users
  if (loading) return <PageLayout loading>{null}</PageLayout>;
  if (!user) return <Navigate to="/login" replace />;

  // Handle loading and errors for catalog data
  if (servicesQuery.isLoading || extrasQuery.isLoading) {
    return <Loading text="Loading services..." />;
  }
  if (servicesQuery.error || extrasQuery.error) {
    return (
      <ErrorMessage
        message={
          servicesQuery.error?.message || extrasQuery.error?.message || 'Error loading data'
        }
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-gray-50 py-8">
        <ToastContainer position="top-right" />
        
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Book Your Car Wash</h1>
            <p className="text-gray-600">Select your service, choose a time, and we'll take care of the rest</p>
          </div>

          {/* Step Indicator */}
          <div className="mb-8">
            <StepIndicator 
              currentStep={currentStep}
              stepsCompleted={currentStep > 1 ? [1] : []}
            />
          </div>

          {/* Step Content */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <AnimatePresence mode="wait">
              {/* Step 1: Service Selection */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="p-6"
                >
                  <h2 className="text-xl font-semibold mb-6">Step 1: Select Your Service</h2>
                  
                  {/* Category Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Service Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(servicesByCategory).map((category) => (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            selectedCategory === category
                              ? 'bg-blue-500 text-white shadow-md'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Service Cards */}
                  {selectedCategory && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Choose Service
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>
                  )}

                  {/* Extras */}
                  {extras.length > 0 && selectedCategory && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Add Extras (Optional)
                      </label>
                      <div className="space-y-3">
                        {extras.map((extra) => (
                          <div
                            key={extra.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <span className="font-medium">{extra.name}</span>
                              <span className="text-sm text-gray-500 ml-2">
                                +R{extra.price_map[selectedCategory] ?? 0}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => setExtraQuantities(prev => ({ 
                                  ...prev, 
                                  [extra.id]: Math.max(0, (prev[extra.id] || 0) - 1) 
                                }))}
                                className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                              >
                                −
                              </button>
                              <span className="w-8 text-center">{extraQuantities[extra.id] || 0}</span>
                              <button
                                type="button"
                                onClick={() => setExtraQuantities(prev => ({ 
                                  ...prev, 
                                  [extra.id]: (prev[extra.id] || 0) + 1 
                                }))}
                                className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 1 Footer */}
                  <div className="flex justify-between items-center pt-6 border-t">
                    <div className="text-lg font-semibold">
                      Total: R{total}
                    </div>
                    <button
                      onClick={handleNextStep}
                      disabled={!canProceedToStep2}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        canProceedToStep2
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
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
                  className="p-6"
                >
                  <h2 className="text-xl font-semibold mb-6">Step 2: Choose Date & Time</h2>
                  
                  <DateTimePicker
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                    onDateTimeChange={handleDateTimeChange}
                    className="mb-6"
                  />

                  {/* Step 2 Footer */}
                  <div className="flex justify-between items-center pt-6 border-t">
                    <button
                      onClick={handlePrevStep}
                      className="px-6 py-3 rounded-lg font-medium bg-gray-200 hover:bg-gray-300 text-gray-700"
                    >
                      Back
                    </button>
                    <div className="text-lg font-semibold">
                      Total: R{total}
                    </div>
                    <button
                      onClick={handleNextStep}
                      disabled={!canProceedToStep3}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        canProceedToStep3
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
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
                  className="p-6"
                >
                  <h2 className="text-xl font-semibold mb-6">Step 3: Review Your Booking</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Booking Summary */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold mb-3">Booking Summary</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Service:</span>
                          <span className="font-medium">{selectedService?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Quantity:</span>
                          <span className="font-medium">{serviceQuantity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Date:</span>
                          <span className="font-medium">
                            {new Date(selectedDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Time:</span>
                          <span className="font-medium">{selectedTime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Duration:</span>
                          <span className="font-medium">~{selectedService?.duration || 30} min</span>
                        </div>
                      </div>
                    </div>

                    {/* Price Breakdown */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold mb-3">Price Breakdown</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>{selectedService?.name} × {serviceQuantity}</span>
                          <span>R{selectedService ? selectedService.base_price * serviceQuantity : 0}</span>
                        </div>
                        {extras.map(extra => {
                          const qty = extraQuantities[extra.id] || 0;
                          if (qty > 0) {
                            const price = (extra.price_map[selectedCategory] ?? 0) * qty;
                            return (
                              <div key={extra.id} className="flex justify-between">
                                <span>{extra.name} × {qty}</span>
                                <span>R{price}</span>
                              </div>
                            );
                          }
                          return null;
                        })}
                        <div className="border-t pt-2 font-semibold flex justify-between">
                          <span>Total:</span>
                          <span>R{total}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 Footer */}
                  <div className="flex justify-between items-center pt-6 border-t">
                    <button
                      onClick={handlePrevStep}
                      className="px-6 py-3 rounded-lg font-medium bg-gray-200 hover:bg-gray-300 text-gray-700"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={`px-8 py-3 rounded-lg font-medium transition-all ${
                        isSubmitting
                          ? 'bg-blue-300 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 shadow-md'
                      } text-white`}
                    >
                      {isSubmitting ? 'Confirming...' : 'Confirm Booking'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Booking Confirmation Modal */}
        {confirmedOrder && (
          <BookingConfirmation
            isVisible={showConfirmation}
            onComplete={handleConfirmationComplete}
            orderDetails={confirmedOrder}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default OrderForm;
