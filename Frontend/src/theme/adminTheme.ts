/**
 * Admin Theme Tokens
 * Centralized design system for consistent styling across admin pages
 * Following modern UI industry standards with 8-point grid system
 */

export const adminTheme = {
  // Color Gradients
  colors: {
    primary: 'from-blue-600 via-blue-700 to-indigo-800',
    primaryHover: 'from-blue-700 to-indigo-900',
    accent: 'from-purple-500 to-pink-600',
    success: 'from-emerald-500 to-teal-600',
    warning: 'from-amber-500 to-orange-600',
    danger: 'from-rose-500 to-red-600',
    neutral: 'from-slate-400 to-gray-500',
    
    // Background gradients
    bgSubtle: 'from-slate-50 to-gray-50',
    bgCard: 'bg-white',
    bgHover: 'from-gray-50 to-gray-100',
    
    // Category colors for quick actions
    categoryColors: {
      blue: {
        bg: 'from-blue-100 to-blue-200 group-hover:from-blue-200 group-hover:to-blue-300',
        text: 'text-blue-600',
      },
      green: {
        bg: 'from-green-100 to-green-200 group-hover:from-green-200 group-hover:to-green-300',
        text: 'text-green-600',
      },
      purple: {
        bg: 'from-purple-100 to-purple-200 group-hover:from-purple-200 group-hover:to-purple-300',
        text: 'text-purple-600',
      },
      orange: {
        bg: 'from-orange-100 to-orange-200 group-hover:from-orange-200 group-hover:to-orange-300',
        text: 'text-orange-600',
      },
      teal: {
        bg: 'from-teal-100 to-teal-200 group-hover:from-teal-200 group-hover:to-teal-300',
        text: 'text-teal-600',
      },
      indigo: {
        bg: 'from-indigo-100 to-indigo-200 group-hover:from-indigo-200 group-hover:to-indigo-300',
        text: 'text-indigo-600',
      },
      yellow: {
        bg: 'from-yellow-100 to-yellow-200 group-hover:from-yellow-200 group-hover:to-yellow-300',
        text: 'text-yellow-600',
      },
      red: {
        bg: 'from-red-100 to-red-200 group-hover:from-red-200 group-hover:to-red-300',
        text: 'text-red-600',
      },
    },
  },

  // Shadow System (elevation levels)
  shadows: {
    sm: 'shadow-sm',
    md: 'shadow-md shadow-gray-200/50',
    lg: 'shadow-lg shadow-gray-300/40',
    xl: 'shadow-xl shadow-gray-400/30',
    
    // Colored shadows for accents
    blueSm: 'shadow-sm shadow-blue-500/20',
    blueMd: 'shadow-md shadow-blue-500/25',
    blueLg: 'shadow-lg shadow-blue-500/30',
    blueXl: 'shadow-xl shadow-blue-500/40',
  },

  // Spacing System (8-point grid)
  spacing: {
    // Page-level
    pageContainer: 'max-w-7xl mx-auto px-4 py-4',
    pageContainerLg: 'max-w-7xl mx-auto px-6 py-6',
    sectionGap: 'space-y-6',
    sectionGapCompact: 'space-y-4',
    
    // Card-level
    cardPadding: 'p-4',
    cardPaddingLg: 'p-5',
    cardGap: 'gap-4',
    
    // Component-level
    componentGap: 'space-y-3',
    componentGapTight: 'space-y-2',
    componentGapCompact: 'space-y-1',
  },

  // Border Radius
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    full: 'rounded-full',
  },

  // Typography
  typography: {
    // Headings
    h1: 'text-2xl font-bold text-gray-800',
    h2: 'text-lg font-bold text-gray-800',
    h3: 'text-base font-semibold text-gray-900',
    
    // Body
    body: 'text-sm text-gray-700',
    bodyMuted: 'text-sm text-gray-600',
    caption: 'text-xs text-gray-500',
    
    // Special
    label: 'text-sm font-medium text-gray-700',
    badge: 'text-xs font-semibold',
  },

  // Transitions
  transitions: {
    fast: 'transition-all duration-200',
    normal: 'transition-all duration-300',
    slow: 'transition-all duration-500',
    
    // Specific properties
    colors: 'transition-colors duration-200',
    transform: 'transition-transform duration-300',
    opacity: 'transition-opacity duration-200',
  },

  // Interactive States
  interactive: {
    hover: {
      lift: 'hover:-translate-y-0.5',
      liftLg: 'hover:-translate-y-1',
      scale: 'hover:scale-105',
      scaleSm: 'hover:scale-[1.02]',
    },
    active: {
      scale: 'active:scale-95',
    },
    focus: {
      ring: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    },
  },

  // Component Presets
  components: {
    button: {
      primary: 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg px-4 py-2 font-medium shadow-md hover:shadow-lg hover:from-blue-700 hover:to-indigo-800 transition-all duration-300',
      secondary: 'bg-white text-gray-700 border border-gray-300 rounded-lg px-4 py-2 font-medium hover:bg-gray-50 transition-colors duration-200',
      ghost: 'text-gray-700 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors duration-200',
    },
    card: {
      base: 'bg-white rounded-xl p-4 shadow-sm border border-gray-100',
      hover: 'bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-300',
      elevated: 'bg-white rounded-xl p-5 shadow-md border border-gray-100',
    },
    input: {
      base: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
      error: 'w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent',
    },
  },

  // Z-Index Scale
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    fixed: 30,
    modalBackdrop: 40,
    modal: 50,
    popover: 60,
    tooltip: 70,
  },
} as const;

// Type exports for TypeScript
export type AdminTheme = typeof adminTheme;
export type ColorKey = keyof typeof adminTheme.colors.categoryColors;
export type ShadowKey = keyof typeof adminTheme.shadows;
export type SpacingKey = keyof typeof adminTheme.spacing;
