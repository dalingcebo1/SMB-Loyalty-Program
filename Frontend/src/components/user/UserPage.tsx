import React from 'react';

type UserPageSize = 'default' | 'narrow' | 'wide';

interface UserPageProps {
  children: React.ReactNode;
  className?: string;
  size?: UserPageSize;
  id?: string;
  role?: string;
}

const UserPage: React.FC<UserPageProps> = ({
  children,
  className = '',
  size = 'default',
  id,
  role,
}) => {
  const classes = [
    'user-page',
    size === 'narrow' ? 'user-page--narrow' : null,
    size === 'wide' ? 'user-page--wide' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} id={id} role={role}>
      {children}
    </div>
  );
};

export default UserPage;
