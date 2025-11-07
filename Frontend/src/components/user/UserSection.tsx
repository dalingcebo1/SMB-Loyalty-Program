import React from 'react';

type SectionElement = keyof JSX.IntrinsicElements;

interface UserSectionProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  as?: SectionElement;
  id?: string;
  role?: string;
}

const UserSection: React.FC<UserSectionProps> = ({
  children,
  className = '',
  title,
  subtitle,
  eyebrow,
  actions,
  as: Component = 'section',
  id,
  role,
}) => {
  const classes = ['user-page__section', 'user-section', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} id={id} role={role}>
      {eyebrow || title || subtitle || actions ? (
        <header className="user-section__header">
          <div className="user-section__meta">
            {eyebrow ? <span className="user-section__eyebrow">{eyebrow}</span> : null}
            {title ? <h2 className="user-section__title">{title}</h2> : null}
            {subtitle ? <p className="user-section__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="user-section__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </Component>
  );
};

export default UserSection;
