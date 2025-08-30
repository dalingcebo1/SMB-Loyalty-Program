// Centralized professional icon mapping for staff UI
import React from 'react';
import {
  FaChartBar,
  FaCheckCircle,
  FaSyncAlt,
  FaClock,
  FaBolt,
  FaCarAlt,
  FaSoap,
  FaTimes,
  FaSpinner,
  FaUser,
  FaMoneyBillWave,
  FaSearch
} from 'react-icons/fa';

export type StaffIconName =
  | 'analytics'
  | 'completed'
  | 'inProgress'
  | 'duration'
  | 'performance'
  | 'car'
  | 'wash'
  | 'close'
  | 'loading'
  | 'user'
  | 'revenue'
  | 'search';

const iconMap: Record<StaffIconName, React.ReactElement> = {
  analytics: <FaChartBar />,
  completed: <FaCheckCircle />,
  inProgress: <FaSyncAlt />,
  duration: <FaClock />,
  performance: <FaBolt />,
  car: <FaCarAlt />,
  wash: <FaSoap />,
  close: <FaTimes />,
  loading: <FaSpinner className="spin" />,
  user: <FaUser />,
  revenue: <FaMoneyBillWave />,
  search: <FaSearch />
};

interface StaffIconProps {
  name: StaffIconName;
  className?: string;
  title?: string;
  size?: number | string;
}

export const StaffIcon: React.FC<StaffIconProps> = ({ name, className = '', title, size = 16 }) => {
  const icon = iconMap[name];
  return (
    <span className={`staff-icon ${className}`} title={title} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size }}>
      {icon}
    </span>
  );
};

export default StaffIcon;