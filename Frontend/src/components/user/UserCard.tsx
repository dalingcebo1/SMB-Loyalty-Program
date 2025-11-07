import React from 'react';

type UserCardElement = keyof HTMLElementTagNameMap;
type UserCardPadding = 'default' | 'tight' | 'loose';

type PolymorphicProps<E extends UserCardElement> = {
  as?: E;
} & React.ComponentPropsWithoutRef<E>;

type UserCardProps<E extends UserCardElement = 'div'> = {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  muted?: boolean;
  padding?: UserCardPadding;
} & PolymorphicProps<E>;

const UserCard = <E extends UserCardElement = 'div'>({
  children,
  className = '',
  interactive = false,
  muted = false,
  as,
  padding = 'default',
  ...rest
}: UserCardProps<E>) => {
  const Component = as || 'div';
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

  return React.createElement(Component, { className: classes, ...rest }, children);
};

export default UserCard;
