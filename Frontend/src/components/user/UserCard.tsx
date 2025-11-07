import React from 'react';

type UserCardElement = keyof JSX.IntrinsicElements;
type UserCardPadding = 'default' | 'tight' | 'loose';

interface UserCardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  muted?: boolean;
  as?: UserCardElement;
  padding?: UserCardPadding;
  id?: string;
  role?: string;
}

const UserCard: React.FC<UserCardProps> = ({
  children,
  className = '',
  interactive = false,
  muted = false,
  as: Component = 'div',
  padding = 'default',
  id,
  role,
}) => {
  const classes = [
    'user-card',
    'surface-card',
    interactive ? 'surface-card--interactive' : null,
    muted ? 'surface-card--muted' : null,
    padding !== 'default' ? `user-card--${padding}` : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} id={id} role={role}>
      {children}
    </Component>
  );
};

export default UserCard;
