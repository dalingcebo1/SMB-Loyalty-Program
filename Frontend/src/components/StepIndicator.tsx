import { FC, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { trackStepView } from '../utils/analytics';
import './StepIndicator.css';

interface StepIndicatorProps {
  currentStep: number; // 1-based index
  // list of completed step numbers
  stepsCompleted?: number[];
}

const steps = [
  { label: 'Select Service', ariaLabel: 'Step 1: Select Service' },
  { label: 'Choose Time', ariaLabel: 'Step 2: Choose Time' },
  { label: 'Review & Confirm', ariaLabel: 'Step 3: Review and Confirm' }
];

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
    if (step < currentStep || stepsCompleted.includes(step)) {
      navigate(routesMap[step]);
    }
  };

  return (
    <nav 
      className="step-indicator" 
      role="navigation" 
      aria-label="Progress through booking steps"
    >
      {steps.map((step, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepsCompleted.includes(stepNum) || stepNum < currentStep;
        const isClickable = stepNum < currentStep || stepsCompleted.includes(stepNum);
        
        return (
          <div key={step.label} className="step-indicator-item">
            <div
              className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isClickable ? 'clickable' : ''}`}
              onClick={() => isClickable && handleStepClick(stepNum)}
              onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleStepClick(stepNum);
                }
              }}
              role={isClickable ? 'button' : 'text'}
              tabIndex={isClickable ? 0 : -1}
              aria-label={`${step.ariaLabel}${isActive ? ' (current step)' : ''}${isCompleted ? ' (completed)' : ''}`}
              aria-current={isActive ? 'step' : undefined}
              aria-disabled={!isClickable}
              title={isClickable ? `Go to ${step.label}` : step.label}
            >
              <div className="step-number-container">
                <motion.div
                  className="step-number"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: isActive ? 1 : 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  aria-hidden="true"
                >
                  {isCompleted && stepNum !== currentStep ? '✓' : stepNum}
                </motion.div>
              </div>
              <span className="step-label" aria-hidden="true">{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <motion.div
                className={`step-connector ${isCompleted ? 'completed' : ''}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isCompleted ? 1 : 0 }}
                style={{ transformOrigin: 'left' }}
                transition={{ duration: 0.3 }}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
};

export default StepIndicator;
