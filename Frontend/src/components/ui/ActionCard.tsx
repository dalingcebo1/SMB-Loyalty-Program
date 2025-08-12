import React from 'react';
import { Link } from 'react-router-dom';

interface ActionCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

const ActionCard: React.FC<ActionCardProps> = ({ to, icon, title, description, className }) => {
  return (
    <Link
      to={to}
      className={`group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 rounded-2xl bg-white shadow-md hover:shadow-lg transition-shadow p-6 flex flex-col items-center text-center ${className || ''}`}
      aria-label={title}
    >
      <div className="w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 mb-4 group-hover:scale-105 transition-transform" aria-hidden>
        {icon}
      </div>
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-gray-500 text-sm leading-snug">{description}</p>
    </Link>
  );
};

export default ActionCard;
