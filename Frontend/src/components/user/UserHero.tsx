import React from 'react';

type UserHeroAlign = 'center' | 'start';
type UserHeroVariant = 'default' | 'compact';

interface UserHeroProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  align?: UserHeroAlign;
  variant?: UserHeroVariant;
  className?: string;
  id?: string;
}

const UserHero: React.FC<UserHeroProps> = ({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  align = 'center',
  variant = 'default',
  className = '',
  id,
}) => {
  const classes = [
    'user-hero',
    variant === 'compact' ? 'user-hero--compact' : null,
    align === 'start' ? 'user-hero--start' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes} id={id}>
      {eyebrow ? <span className="user-hero__eyebrow">{eyebrow}</span> : null}
      <h1 className="user-hero__title">{title}</h1>
      {subtitle ? <p className="user-hero__subtitle">{subtitle}</p> : null}
      {children}
      {actions ? <div className="user-hero__actions">{actions}</div> : null}
    </section>
  );
};

export default UserHero;
