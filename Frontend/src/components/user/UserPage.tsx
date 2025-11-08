import React from 'react';

type UserPageSize = 'default' | 'narrow' | 'wide';
type UserPageLayout = 'default' | 'split' | 'full';

interface UserPageProps {
  children: React.ReactNode;
  className?: string;
  size?: UserPageSize;
  layout?: UserPageLayout;
  aside?: React.ReactNode; // optional aside content for split layout
  id?: string;
  role?: string;
}

const UserPage: React.FC<UserPageProps> = ({
  children,
  className = '',
  size = 'default',
  layout = 'default',
  aside,
  id,
  role,
}) => {
  const classes = [
    'user-page',
    size === 'narrow' ? 'user-page--narrow' : null,
    size === 'wide' ? 'user-page--wide' : null,
    layout === 'split' ? 'user-page--layout-split u-grid u-grid--split' : null,
    layout === 'full' ? 'user-page--layout-full' : null,
    className,
  ].filter(Boolean).join(' ');

  if (layout === 'split') {
    return (
      <div className={classes} id={id} role={role}>
        <div className="user-page__main">{children}</div>
        <aside className="user-page__aside u-aside" aria-label="Secondary information">
          {aside}
        </aside>
      </div>
    );
  }

  return <div className={classes} id={id} role={role}>{children}</div>;
};

export default UserPage;
