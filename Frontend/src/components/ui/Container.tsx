// src/components/ui/Container.tsx
import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
}

const Container: React.FC<ContainerProps> = ({ children }) => (
  <div className="max-w-7xl mx-auto px-6 py-4">
    {children}
  </div>
);

export default Container;
