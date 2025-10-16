// src/features/staff/components/StaffEligibilityGate.tsx
import React from 'react';
import StaffPageContainer from './StaffPageContainer';
import { useCapabilities } from '../../admin/hooks/useCapabilities';

interface StaffEligibilityGateProps {
  children: React.ReactNode;
  /** Capabilities the viewer must have. Every capability listed must be present. */
  required?: string[];
  /** At least one of these capabilities must be present if provided. */
  anyOf?: string[];
  /** Optional custom fallback to render when access is denied. */
  fallback?: React.ReactNode;
  title?: string;
  description?: string;
}

const defaultTitle = 'You do not have access to this tool';
const defaultDescription = 'Please contact an administrator if you believe you should have access to this section.';

const StaffEligibilityGate: React.FC<StaffEligibilityGateProps> = ({
  children,
  required = [],
  anyOf,
  fallback,
  title = defaultTitle,
  description = defaultDescription,
}) => {
  const { has } = useCapabilities();

  const meetsAllRequired = required.every((cap) => has(cap));
  const meetsAny = !anyOf || anyOf.some((cap) => has(cap));
  const eligible = meetsAllRequired && meetsAny;

  if (eligible) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <StaffPageContainer
      surface="solid"
      width="xl"
      padding="default"
      className="mx-auto flex flex-col items-center gap-4 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
          <path
            d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10Zm0-14a1 1 0 0 0-.993.883L11 9v4a1 1 0 0 0 1.993.117L13 13V9a1 1 0 0 0-1-1Zm.002 8c-.552 0-1 .45-1 1.004 0 .553.448 1.003 1 1.003.552 0 1-.45 1-1.003 0-.554-.448-1.004-1-1.004Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="max-w-lg text-sm text-slate-600">{description}</p>
    </StaffPageContainer>
  );
};

export default StaffEligibilityGate;
