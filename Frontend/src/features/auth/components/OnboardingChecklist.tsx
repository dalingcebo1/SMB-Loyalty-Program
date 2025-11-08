import React from 'react';

interface OnboardingChecklistProps {
  currentStep: 'profile' | 'phone';
  completedProfile: boolean;
}

// Minimal placeholder implementation.
// Future enhancements: dynamic progress percentages, animation, ARIA live updates.
const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ currentStep, completedProfile }) => {
  return (
    <div className="onboarding-checklist" role="list" aria-label="Onboarding progress">
      <div role="listitem" className={`checklist-item ${completedProfile ? 'completed' : currentStep === 'profile' ? 'active' : ''}`}>
        <span className="checklist-status" aria-hidden="true">{completedProfile ? '✓' : '1'}</span>
        <span className="checklist-label">Profile Info</span>
      </div>
      <div role="listitem" className={`checklist-item ${currentStep === 'phone' ? 'active' : ''}`}> 
        <span className="checklist-status" aria-hidden="true">{currentStep === 'phone' ? '2' : completedProfile ? '2' : ''}</span>
        <span className="checklist-label">Phone Verification</span>
      </div>
    </div>
  );
};

export default OnboardingChecklist;
