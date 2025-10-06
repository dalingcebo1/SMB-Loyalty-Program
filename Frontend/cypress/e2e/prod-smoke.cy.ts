// @ts-nocheck

describe('Production smoke checks', () => {
  const ensureNoErrorBoundary = () => {
    cy.get('body', { timeout: 20000 }).should('not.contain', 'Oops! Something went wrong');
    cy.get('[role="alertdialog"]', { timeout: 20000 }).should('not.exist');
  };

  const logoutIfPossible = () => {
    cy.get('body').then(($body) => {
      const candidate = $body
        .find('button, a')
        .filter((_, el) => (el.textContent || '').toLowerCase().includes('sign out'))
        .first();

      if (candidate.length) {
        cy.wrap(candidate).click({ force: true });
        cy.wait(1000);
      }
    });
    cy.clearCookies({ log: false });
    cy.clearLocalStorage();
  };

  const setupConsoleSpy = () => {
    cy.on('window:before:load', (win) => {
      cy.stub(win.console, 'error').as('consoleError');
    });
  };

  const loginViaUi = (emailEnvKey: string, passwordEnvKey: string) => {
    const email = Cypress.env(emailEnvKey) as string | undefined;
    const password = Cypress.env(passwordEnvKey) as string | undefined;

    if (!email || !password) {
      throw new Error(`Missing Cypress env vars ${emailEnvKey}/${passwordEnvKey}`);
    }

    setupConsoleSpy();
    cy.login(email, password);
  };

  beforeEach(() => {
    cy.clearCookies({ log: false });
    cy.clearLocalStorage();
  });

  afterEach(() => {
    cy.get('@consoleError').then((stub) => {
      expect(stub).to.have.property('callCount');
      expect(stub).to.have.callCount(0);
    });
    logoutIfPossible();
  });

  it('allows admin to reach the admin overview without error boundary', () => {
    loginViaUi('ADMIN_EMAIL', 'ADMIN_PASSWORD');

    cy.location('pathname', { timeout: 60000 }).should('match', /\/admin(\/?|$)/);
    cy.contains('Admin Panel', { timeout: 20000 }).should('be.visible');
    ensureNoErrorBoundary();
  });

  it('allows staff to reach the staff dashboard without error boundary', () => {
    loginViaUi('STAFF_EMAIL', 'STAFF_PASSWORD');

  cy.location('pathname', { timeout: 60000 }).should('include', '/staff');
  cy.contains('Staff Dashboard', { timeout: 20000 }).should('be.visible');
    ensureNoErrorBoundary();
  });

  it('allows standard user to reach the customer dashboard without error boundary', () => {
    loginViaUi('USER_EMAIL', 'USER_PASSWORD');

    cy.location('pathname', { timeout: 60000 }).should((pathname: string) => {
      expect(pathname === '/' || pathname.startsWith('/my')).to.be.true;
    });
    cy.contains(/welcome|loyalty|dashboard/i, { timeout: 20000 });
    ensureNoErrorBoundary();
  });
});
