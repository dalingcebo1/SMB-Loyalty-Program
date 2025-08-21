// cypress/support/e2e.ts
import './commands';

Cypress.on('uncaught:exception', () => {
  // Prevent test failures due to uncaught exceptions in app
  return false;
});
