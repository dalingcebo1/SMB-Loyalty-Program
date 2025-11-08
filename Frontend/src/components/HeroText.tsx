import React from "react";
import "./hero-text.css";

export interface HeroTextProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Heading level for semantic correctness (defaults to h1) */
  as?: "h1" | "h2" | "h3" | "h4";
  /** Text alignment; center adds auto margin to subtitle */
  align?: "left" | "center";
  /** Optional override for subtitle max width (e.g. "50ch" or "28rem") */
  subtitleMaxWidth?: string;
  /** Optional id for anchoring */
  id?: string;
  className?: string;
  /** Visual tone for contrasting backgrounds */
  tone?: "default" | "inverted" | "subtle" | "brand";
  /** Layout mode: stack or inline with aside */
  layout?: "stack" | "inline";
  /** Optional aside content (badge / controls) */
  aside?: React.ReactNode;
  /** Stepped responsive sizing */
  stepped?: boolean;
  /** Compact tracking and tighter leading */
  compact?: boolean;
}

/**
 * HeroText consolidates eyebrow, title and subtitle with balanced wrapping & responsive sizing.
 * It intentionally mirrors existing auth header styling while enabling reuse & future localization length tuning.
 */
let warnedDuplicateH1 = false; // module-level to avoid reinitializing across renders

export const HeroText: React.FC<HeroTextProps> = ({
  eyebrow,
  title,
  subtitle,
  as = "h1",
  align = "left",
  subtitleMaxWidth,
  tone = "default",
  layout = "stack",
  aside,
  stepped = false,
  compact = false,
  id,
  className = ""
}) => {
  const HeadingTag = as;
  // Inline CSS variable for subtitle max width (cast to allow custom property)
  const style: React.CSSProperties = subtitleMaxWidth
    ? ({ "--hero-subtitle-max": subtitleMaxWidth } as React.CSSProperties)
    : {};

  // Dev-only duplicate h1 warning logic
  if (process.env.NODE_ENV !== 'production' && as === 'h1' && typeof document !== 'undefined') {
    // defer to next microtask to allow second heading to mount
    queueMicrotask(() => {
      if (warnedDuplicateH1) return;
      const existingH1 = document.querySelectorAll('h1').length;
      if (existingH1 > 1) {
        // eslint-disable-next-line no-console
        console.warn('[HeroText] Multiple h1 headings detected; ensure unique page-level heading semantics.');
        warnedDuplicateH1 = true;
      }
    });
  }

  const variantClasses = [
    'hero-text--v2',
    stepped ? 'hero-text--stepped' : '',
    layout === 'inline' ? 'hero-text--inline' : '',
    compact ? 'hero-text--compact' : '',
    align === 'center' ? 'hero-text--center' : ''
  ].filter(Boolean).join(' ');

  return (
    <header
      id={id}
      className={`hero-text hero-text--${align} ${variantClasses} ${className}`.trim()}
      style={style}
      data-component="HeroText"
      data-tone={tone}
    >
      {eyebrow && (
        <span className="hero-text__eyebrow" data-part="eyebrow">
          {eyebrow}
        </span>
      )}
      <HeadingTag className="hero-text__title" data-part="title">
        {title}
      </HeadingTag>
      {subtitle && (
        <p className="hero-text__subtitle" data-part="subtitle">
          {subtitle}
        </p>
      )}
      {aside && layout === 'inline' && (
        <div className="hero-text__aside" data-part="aside">{aside}</div>
      )}
    </header>
  );
};

export default HeroText;
