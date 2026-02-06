import React from 'react';
import { Link } from 'react-router-dom';
import { HiChevronRight, HiHome } from 'react-icons/hi';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav className="flex items-center space-x-2 text-sm mb-4" aria-label="Breadcrumb">
      <Link
        to="/admin"
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        aria-label="Home"
      >
        <HiHome className="w-4 h-4" />
      </Link>
      
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <React.Fragment key={index}>
            <HiChevronRight className="w-4 h-4 text-gray-400" />
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-gray-900 font-medium' : 'text-gray-600'}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
