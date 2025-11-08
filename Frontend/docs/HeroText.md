## HeroText Component

`HeroText` standardizes page-intro content (eyebrow, title, subtitle) with balanced wrapping and responsive sizing.

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `eyebrow` | ReactNode | - | Uppercased label above title |
| `title` | ReactNode | required | Main heading text |
| `subtitle` | ReactNode | - | Supporting descriptive copy |
| `as` | `h1|h2|h3|h4` | `h1` | Semantic heading level |
| `align` | `left|center` | `left` | Text alignment; centers subtitle with auto margins |
| `subtitleMaxWidth` | string | `42ch` | Override width token for long localized strings |
| `id` | string | - | Optional anchor id |

### Wrapping & Balance
Uses `text-wrap: balance` when supported; falls back to prudent `overflow-wrap: break-word`. Avoid hard manual `<br/>`—adjust `subtitleMaxWidth` or content length instead.

### CSS Custom Property
Set `subtitleMaxWidth` to tune wrapping for localization or marketing campaigns:

```tsx
<HeroText title="Summer Specials" subtitle="Exclusive multi-service bundles right at participating locations." subtitleMaxWidth="48ch" />
```

### Accessibility
Choose `as` to reflect document hierarchy (e.g. secondary sections use `h2`). Eyebrow is plain text (not announced as a heading). Subtitle rendered as a paragraph for proper semantics.

### Theming
Colors inherit from existing global CSS variables (`--color-text`, `--color-text-soft`). No direct color props—brand theming handled centrally.

### Migration Pattern
Replace repeated header markup:

```diff
-<header className="auth-header"> ... </header>
+<HeroText eyebrow="Create account" title="Join ChaosX Loyalty" subtitle="Book car wash services, earn rewards..." align="center" />
```

### Testing
Unit tests cover rendering, custom heading level, alignment & width variable. Extend with visual regression via Cypress if needed.
