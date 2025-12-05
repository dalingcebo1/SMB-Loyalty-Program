import { ExtensionComponent } from './types';

// Registry to hold the mapping of Action Type -> Component
const registry: Record<string, ExtensionComponent> = {};

export const registerExtension = (actionType: string, component: ExtensionComponent) => {
  if (registry[actionType]) {
    console.warn(`Extension for action type "${actionType}" is already registered. Overwriting.`);
  }
  registry[actionType] = component;
};

export const getExtension = (actionType: string): ExtensionComponent | null => {
  return registry[actionType] || null;
};

// Helper to register multiple extensions
export const registerExtensions = (extensions: Record<string, ExtensionComponent>) => {
  Object.entries(extensions).forEach(([type, component]) => {
    registerExtension(type, component);
  });
};
