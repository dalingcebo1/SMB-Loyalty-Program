import React, { useState, ImgHTMLAttributes } from 'react';
import { FaUser } from 'react-icons/fa';
import './Avatar.css';

export type AvatarSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';

export interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'size'> {
  size?: AvatarSize;
  name?: string;
  src?: string;
  fallbackIcon?: React.ReactNode;
  status?: 'online' | 'offline' | 'away' | 'busy';
}

/**
 * Modern Avatar Component
 * 
 * Features:
 * - Multiple sizes
 * - Image with fallback to initials or icon
 * - Optional status indicator
 * - Accessible with proper alt text
 * 
 * @example
 * <Avatar src="/user.jpg" name="John Doe" size="lg" status="online" />
 * <Avatar name="Jane Smith" size="base" />
 */
export const Avatar: React.FC<AvatarProps> = ({
  size = 'base',
  name,
  src,
  fallbackIcon,
  status,
  alt,
  className = '',
  ...props
}) => {
  const [imageError, setImageError] = useState(false);

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const showImage = src && !imageError;
  const showInitials = !showImage && name;
  const showIcon = !showImage && !showInitials;

  const combinedClassName = [
    'avatar',
    `avatar--${size}`,
    status && 'avatar--with-status',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={combinedClassName}>
      <div className="avatar-content">
        {showImage && (
          <img
            src={src}
            alt={alt || name || 'User avatar'}
            className="avatar-image"
            onError={() => setImageError(true)}
            {...props}
          />
        )}
        {showInitials && (
          <span className="avatar-initials" aria-label={name}>
            {getInitials(name)}
          </span>
        )}
        {showIcon && (
          <span className="avatar-icon" aria-label="User">
            {fallbackIcon || <FaUser />}
          </span>
        )}
      </div>
      {status && (
        <span
          className={`avatar-status avatar-status--${status}`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
};

export default Avatar;
