// @ts-nocheck

describe('Production smoke checks', () => {
  const credentialPairs = [
    { role: 'admin', emailKey: 'ADMIN_EMAIL', passwordKey: 'ADMIN_PASSWORD' },
    { role: 'staff', emailKey: 'STAFF_EMAIL', passwordKey: 'STAFF_PASSWORD' },
    { role: 'user', emailKey: 'USER_EMAIL', passwordKey: 'USER_PASSWORD' },
  ] as const;

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

  const loginViaUi = (emailEnvKey: string, passwordEnvKey: string) => {
    const email = Cypress.env(emailEnvKey) as string | undefined;
    const password = Cypress.env(passwordEnvKey) as string | undefined;

    if (!email || !password) {
      throw new Error(`Missing Cypress env vars ${emailEnvKey}/${passwordEnvKey}`);
    }

    cy.login(email, password);
  };

  before(function () {
    const missing = credentialPairs
      .flatMap(({ emailKey, passwordKey }) => [emailKey, passwordKey])
      .filter((key) => !Cypress.env(key));

    if (missing.length) {
      Cypress.log({
        name: 'skip',
        message: `Skipping production smoke: missing env vars ${missing.join(', ')}`,
      });
      this.skip();
    }
  });

  beforeEach(() => {
    cy.on('window:before:load', (win) => {
      cy.stub(win.console, 'error').as('consoleError');
    });
    cy.clearCookies({ log: false });
    cy.clearLocalStorage();
  });

  afterEach(() => {
    cy.get('@consoleError', { log: false }).then((stub) => {
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
