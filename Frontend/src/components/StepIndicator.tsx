import { FC, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { trackStepView } from '../utils/analytics';

interface StepIndicatorProps {
  currentStep: number; // 1-based index
  // list of completed step numbers
  stepsCompleted?: number[];
}

const steps = ['Book Service', 'Payment', 'Confirmation'];

const StepIndicator: FC<StepIndicatorProps> = ({ currentStep, stepsCompleted = [] }) => {
  const navigate = useNavigate();
  // Track analytics when the current step is rendered
  useEffect(() => {
    trackStepView(currentStep);
  }, [currentStep]);

  const routesMap: { [key: number]: string } = {
    1: '/order',
    2: '/order/payment',
    3: '/order/confirmation',
  };

  const handleStepClick = (step: number) => {
    if (step < currentStep) {
      navigate(routesMap[step]);
    }
  };
  return (
    <div className="flex justify-center items-center mb-4 space-x-2 sm:space-x-4 overflow-x-auto px-2">
      {steps.map((label, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepsCompleted.length > 0 ? stepsCompleted.includes(stepNum) : stepNum < currentStep;
        return (
          <div
            key={label}
            className={`flex items-center ${isCompleted ? 'cursor-pointer' : ''}`}
            onClick={() => isCompleted && handleStepClick(stepNum)}
            onKeyDown={(e) => {
              if (isCompleted && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handleStepClick(stepNum);
              }
            }}
            role={isCompleted ? 'button' : undefined}
            tabIndex={isCompleted ? 0 : -1}
          >
            <motion.div
              className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                isCompleted
                  ? 'bg-green-500 text-white'
                  : isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}
              initial={{ scale: 0.8 }}
              animate={{ scale: isActive ? 1.2 : 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {stepNum}
            </motion.div>
            <span className={`ml-2 ${isCompleted ? 'text-green-500' : isActive ? 'text-blue-600' : 'text-gray-600'}`}>
              {label}
            </span>
            {idx < steps.length - 1 && (
              <motion.div
                className={`mx-2 h-px flex-1 ${isCompleted ? 'bg-green-500' : 'bg-gray-400'}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isCompleted ? 1 : 0 }}
                style={{ transformOrigin: 'left' }}
                transition={{ duration: 0.3 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
