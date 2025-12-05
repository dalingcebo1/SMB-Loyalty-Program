import React from 'react';
import { ClientAction } from './types';
import { getExtension } from './registry';

interface ActionHandlerProps {
  action: ClientAction | null;
  onComplete: () => void;
}

export const ActionHandler: React.FC<ActionHandlerProps> = ({ action, onComplete }) => {
  if (!action) {
    return null;
  }

  const Component = getExtension(action.type);

  if (!Component) {
    console.warn(`No extension registered for action type: ${action.type}`);
    return null;
  }

  return <Component action={action} onComplete={onComplete} />;
};
