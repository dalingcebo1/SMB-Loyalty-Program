// cypress/support/commands.ts

/// <reference types="cypress" />
/* eslint-disable @typescript-eslint/no-namespace */

// Extend Cypress namespace with custom commands
declare global {
  namespace Cypress {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(password, { log: false });
  cy.get('button[type="submit"]').click();
  cy.url().should('not.include', '/login');
});

// Custom command to signup via UI
Cypress.Commands.add('signup', (email: string, password: string) => {
  cy.visit('/signup');
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(password, { log: false });
  cy.get('input[name="confirmPassword"]').type(password, { log: false });
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/onboarding');
});
