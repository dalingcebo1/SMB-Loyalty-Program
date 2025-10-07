import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HiHome } from 'react-icons/hi';

/**
 * FloatingHomeButton - Persistent FAB for quick return to admin dashboard
 * Following Material Design 3.0 principles with modern micro-interactions
 */
const FloatingHomeButton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  
  // Don't show on the home page itself
  if (location.pathname === '/admin' || location.pathname === '/admin/') {
    return null;
  }

  const handleClick = () => {
    navigate('/admin');
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-6 right-6 z-50 group"
      aria-label="Return to admin home"
      title="Home"
    >
      {/* Main FAB */}
      <div className="relative">
        <div
          className={`
            w-14 h-14 rounded-full 
            bg-gradient-to-br from-blue-600 to-indigo-700
            shadow-lg shadow-blue-500/30
            flex items-center justify-center
            transition-all duration-300 ease-out
            ${isHovered 
              ? 'scale-110 shadow-xl shadow-blue-500/40 rotate-[8deg]' 
              : 'scale-100 hover:scale-105'
            }
          `}
        >
          <HiHome 
            className={`
              w-6 h-6 text-white 
              transition-transform duration-300
              ${isHovered ? 'scale-110' : 'scale-100'}
            `}
          />
        </div>

        {/* Ripple effect on hover */}
        {isHovered && (
          <div className="absolute inset-0 rounded-full bg-blue-400 opacity-20 animate-ping" />
        )}

        {/* Tooltip */}
        <div
          className={`
            absolute right-16 top-1/2 -translate-y-1/2
            px-3 py-1.5 rounded-lg
            bg-gray-900 text-white text-sm font-medium
            whitespace-nowrap
            pointer-events-none
            transition-all duration-200
            ${isHovered 
              ? 'opacity-100 translate-x-0' 
              : 'opacity-0 translate-x-2'
            }
          `}
        >
          Back to Home
          {/* Tooltip arrow */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full">
            <div className="border-8 border-transparent border-l-gray-900" />
          </div>
        </div>
      </div>

      {/* Ambient glow effect */}
      <div 
        className={`
          absolute inset-0 rounded-full blur-xl
          bg-gradient-to-br from-blue-400 to-indigo-500
          opacity-0 group-hover:opacity-30
          transition-opacity duration-500
          -z-10
        `}
      />
    </button>
  );
};

export default FloatingHomeButton;
