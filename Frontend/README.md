# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Project Structure

- **src/**: Main source folder
  - **api.ts**: Axios instance configured for backend API calls
  - **App.tsx**: Root component defining routes, guards, and feature flags
  - **components/**: Shared React components
    - **index.ts**: Barrel exports for top-level components (RequireAdmin, Alert, Spinner, Pagination, PageLayout, etc.)
    - **ui/**: UI primitives and form fields (Button, TextField, DataTable, Container)
  - **pages/**: Page-level components organized by area
    - **admin/**: Admin dashboard pages, with HOCs, layouts, ``AnalyticsLayout``, lists, edits, and metrics reports
    - **dev/**: Developer console and provisioning wizard
    - Other app-level routes (Signup, Login, Onboarding, OrderForm, Payment, etc.)
  - **schemas/**: Zod schemas for form validation (admin schemas barrel-exported)
  - **types/**: TypeScript interfaces and types for API models and metrics
  - **utils/**: Utility functions and constants
    - **analytics.ts**: Event tracking stubs
    - **classNames.ts**: Tailwind-friendly class name utility
    - **metrics.ts**: Labels and `humanizeMetric` function for metrics
  - **hooks/**: Custom React hooks (e.g., `useDateRange` for analytics date picker)

## Barrels & Imports
- Components, UI primitives, and schemas use `index.ts` barrels for cleaner imports: e.g. `import { PageLayout, Alert } from 'src/components';`
- Utility functions are re-exported through `src/utils/index.ts`, so you can `import { humanizeMetric } from 'src/utils';`

## Development Commands
- `npm install` to install dependencies
- `npm run dev` to start the Vite development server
- `npm run build` to produce a production build

# Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
