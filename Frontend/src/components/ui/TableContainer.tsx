import React from 'react';

interface TableContainerProps {
  children: React.ReactNode;
  className?: string;
}

const TableContainer: React.FC<TableContainerProps> = ({ children, className }) => (
  <div className={`overflow-x-auto ${className || ''}`}>  
    <div className="min-w-[600px]">  {/* adjust min width for table columns */}
      {children}
    </div>
  </div>
);

export default TableContainer;
