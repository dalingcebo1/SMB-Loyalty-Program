// cypress/support/commands.ts

/// <reference types="cypress" />
/* eslint-disable @typescript-eslint/no-namespace */

// Extend Cypress namespace with custom commands
declare global {
  namespace Cypress {
  interface Chainable<Subject = any> {
      /** Custom command to login via UI */
      login(email: string, password: string): Chainable<Subject>;
      /** Custom command to signup via UI */
      signup(email: string, password: string): Chainable<Subject>;
    }
  }
}

export {};

// Custom command to login via UI
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login');
  cy.get('[data-cy="login-email"]').type(email);
  cy.get('[data-cy="login-password"]').type(password, { log: false });
  cy.get('[data-cy="login-submit"]').click();
  cy.url().should('not.include', '/login');
});

// Custom command to signup via UI
Cypress.Commands.add('signup', (email: string, password: string) => {
  cy.visit('/signup');
  cy.get('[data-cy="signup-email"]').type(email);
  cy.get('[data-cy="signup-password"]').type(password, { log: false });
  cy.get('[data-cy="signup-submit"]').click();
  cy.url().should('include', '/onboarding');
});
