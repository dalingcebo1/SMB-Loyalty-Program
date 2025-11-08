import { render, screen } from '@testing-library/react';
import React from 'react';
import HeroText from '../HeroText';

describe('HeroText', () => {
  it('renders eyebrow, title and subtitle', () => {
    render(<HeroText eyebrow="Eyebrow" title="Main Title" subtitle="Supporting copy goes here." />);
    expect(screen.getByText('Eyebrow')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Main Title' })).toBeInTheDocument();
    expect(screen.getByText('Supporting copy goes here.')).toBeInTheDocument();
  });

  it('supports custom heading level', () => {
    render(<HeroText as="h2" title="Section Title" />);
    const heading = screen.getByRole('heading', { name: 'Section Title' });
    expect(heading.tagName.toLowerCase()).toBe('h2');
  });

  it('applies alignment class and subtitle max width variable', () => {
    render(
      <HeroText
        title="Aligned Title"
        subtitle="Subtitle copy"
        align="center"
        subtitleMaxWidth="50ch"
      />
    );
    const header = screen.getByRole('heading', { name: 'Aligned Title' }).parentElement as HTMLElement;
    expect(header.className).toMatch(/hero-text--center/);
    const subtitle = screen.getByText('Subtitle copy');
    // Style retrieval for custom property may not reflect in jsdom; assert attribute presence
    expect(header.getAttribute('style')).toContain('--hero-subtitle-max: 50ch');
    expect(subtitle).toBeInTheDocument();
  });
});
