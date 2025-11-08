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
}

/**
 * HeroText consolidates eyebrow, title and subtitle with balanced wrapping & responsive sizing.
 * It intentionally mirrors existing auth header styling while enabling reuse & future localization length tuning.
 */
export const HeroText: React.FC<HeroTextProps> = ({
  eyebrow,
  title,
  subtitle,
  as = "h1",
  align = "left",
  subtitleMaxWidth,
  id,
  className = ""
}) => {
  const HeadingTag = as;
  // Inline CSS variable for subtitle max width (cast to allow custom property)
  const style: React.CSSProperties = subtitleMaxWidth
    ? ({ "--hero-subtitle-max": subtitleMaxWidth } as React.CSSProperties)
    : {};

  return (
    <header
      id={id}
      className={`hero-text hero-text--${align} ${className}`.trim()}
      style={style}
      data-component="HeroText"
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
    </header>
  );
};

export default HeroText;
