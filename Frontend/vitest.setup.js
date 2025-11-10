// vitest.setup.js - global test setup
// Suppress noisy React Router future flag warnings until v7 migration is done.
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) {
    return; // swallow
  }
  originalWarn(...args);
};
