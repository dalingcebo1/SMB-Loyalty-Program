describe('Login flow', () => {
  it('loads login page and submits form', () => {
    cy.intercept('GET', '**/auth/me', {
      statusCode: 401,
      body: { detail: 'Not authenticated' },
    }).as('authMe');

    cy.intercept('POST', '**/auth/login', (req) => {
      expect(req.body).to.contain('username=test@example.com');
      req.reply({
        statusCode: 200,
        body: {
          access_token: 'fake-token',
          token_type: 'bearer',
          onboarding_required: false,
          user: {
            id: 1,
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            role: 'admin',
            tenant_id: 'default',
          },
        },
      });
    }).as('loginRequest');

  cy.visit('/login');
    cy.get('[data-cy="login-email"]').type('test@example.com');
    cy.get('[data-cy="login-password"]').type('password');
    cy.get('[data-cy="login-submit"]').click();
    cy.wait('@loginRequest');
    cy.location('pathname').should('eq', '/admin');
  });
});
