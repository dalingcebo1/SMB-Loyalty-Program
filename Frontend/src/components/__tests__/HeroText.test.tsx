import { render, screen } from '@testing-library/react';
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

  it('supports tone and inline layout with aside', () => {
    render(
      <HeroText
        title="Analytics"
        subtitle="Performance overview"
        tone="inverted"
        layout="inline"
        aside={<span data-testid="aside-el">Status</span>}
        stepped
        compact
      />
    );
    const header = screen.getByRole('heading', { name: 'Analytics' }).parentElement as HTMLElement;
    expect(header.dataset.tone).toBe('inverted');
    expect(header.className).toMatch(/hero-text--inline/);
    expect(screen.getByTestId('aside-el')).toBeInTheDocument();
  });

  it('warns when multiple h1 are rendered (dev only)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<div><HeroText title="A" /><HeroText title="B" /></div>);
    // Allow microtask queued warning to fire
    await new Promise(r => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/Multiple h1 headings/);
    warn.mockRestore();
  });
});
