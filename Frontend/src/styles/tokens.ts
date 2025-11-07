// src/styles/tokens.ts

// Centralised design tokens that mirror the CSS custom properties defined in
// design-tokens.css. Components can import these to keep inline styles and
// logic aligned with the global theme contract.

export const color = {
  primary: 'var(--color-primary)',
  primaryHover: 'var(--color-primary-hover)',
  primaryActive: 'var(--color-primary-active)',
  primaryStrong: 'var(--color-primary-strong)',
  onPrimary: 'var(--color-primary-contrast)',
  surface: 'var(--color-surface)',
  surfaceMuted: 'var(--color-surface-muted)',
  surfaceElevated: 'var(--color-surface-elevated)',
  background: 'var(--color-background)',
  backgroundAlt: 'var(--color-background-alt)',
  text: 'var(--color-text)',
  textMuted: 'var(--color-text-muted)',
  textSoft: 'var(--color-text-soft)',
  textInverse: 'var(--color-text-inverse)',
  border: 'var(--color-border)',
  borderSubtle: 'var(--color-border-subtle)',
  borderSoft: 'var(--color-border-soft)',
  borderStrong: 'var(--color-border-strong)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-error)',
  info: 'var(--color-info)',
};

export const space = {
  none: '0',
  xs: 'var(--spacing-1)',
  sm: 'var(--spacing-2)',
  md: 'var(--spacing-3)',
  lg: 'var(--spacing-4)',
  xl: 'var(--spacing-6)',
  xxl: 'var(--spacing-8)',
  xxxl: 'var(--spacing-12)',
  quadruple: 'var(--spacing-16)',
};

export const radii = {
  none: 'var(--radius-none)',
  sm: 'var(--radius-sm)',
  base: 'var(--radius-base)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  xxl: 'var(--radius-xxl)',
  full: 'var(--radius-full)',
};

export const shadow = {
  xs: 'var(--shadow-xs)',
  sm: 'var(--shadow-sm)',
  base: 'var(--shadow-base)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
  xxl: 'var(--shadow-2xl)',
  soft: 'var(--shadow-soft)',
  card: 'var(--shadow-card)',
  cardHover: 'var(--shadow-card-hover)',
  hero: 'var(--shadow-hero)',
  button: 'var(--shadow-button)',
};

export const typography = {
  fontFamilyBase: 'var(--font-family-base)',
  fontFamilyDisplay: 'var(--font-family-display)',
  fontFamilyMono: 'var(--font-family-mono)',
  size: {
    xs: 'var(--font-size-xs)',
    sm: 'var(--font-size-sm)',
    base: 'var(--font-size-base)',
    lg: 'var(--font-size-lg)',
    xl: 'var(--font-size-xl)',
    xxl: 'var(--font-size-2xl)',
    xxxl: 'var(--font-size-3xl)',
    display: 'var(--font-size-4xl)',
  },
  weight: {
    light: 'var(--font-weight-light)',
    regular: 'var(--font-weight-regular)',
    medium: 'var(--font-weight-medium)',
    semiBold: 'var(--font-weight-semibold)',
    bold: 'var(--font-weight-bold)',
    extraBold: 'var(--font-weight-extrabold)',
  },
  lineHeight: {
    tight: 'var(--line-height-tight)',
    snug: 'var(--line-height-snug)',
    normal: 'var(--line-height-normal)',
    relaxed: 'var(--line-height-relaxed)',
    loose: 'var(--line-height-loose)',
  },
  letterSpacing: {
    tight: 'var(--letter-spacing-tight)',
    normal: 'var(--letter-spacing-normal)',
    wide: 'var(--letter-spacing-wide)',
  },
};

export const transitions = {
  fast: 'var(--transition-fast)',
  base: 'var(--transition-base)',
  slow: 'var(--transition-slow)',
  slower: 'var(--transition-slower)',
  easeIn: 'var(--ease-in)',
  easeOut: 'var(--ease-out)',
  easeInOut: 'var(--ease-in-out)',
  easeSpring: 'var(--ease-spring)',
};

export const breakpoints = {
  sm: 'var(--breakpoint-sm)',
  md: 'var(--breakpoint-md)',
  lg: 'var(--breakpoint-lg)',
  xl: 'var(--breakpoint-xl)',
  xxl: 'var(--breakpoint-2xl)',
};

export const zIndex = {
  dropdown: 'var(--z-index-dropdown)',
  sticky: 'var(--z-index-sticky)',
  fixed: 'var(--z-index-fixed)',
  modalBackdrop: 'var(--z-index-modal-backdrop)',
  modal: 'var(--z-index-modal)',
  popover: 'var(--z-index-popover)',
  tooltip: 'var(--z-index-tooltip)',
};

export const tokens = {
  color,
  space,
  radii,
  shadow,
  typography,
  transitions,
  breakpoints,
  zIndex,
};

export type DesignTokens = typeof tokens;

export default tokens;
