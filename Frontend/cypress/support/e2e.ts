// cypress/support/e2e.ts
import './commands';

Cypress.on('uncaught:exception', () => {
  // Prevent test failures due to uncaught exceptions in app
  return false;
});

Cypress.on('window:before:load', (win) => {
  win.addEventListener('error', (event) => {
    console.error('[cypress] window error:', event.message);
  });
  win.addEventListener('unhandledrejection', (event) => {
    console.error('[cypress] unhandled rejection:', event.reason);
  });
});
