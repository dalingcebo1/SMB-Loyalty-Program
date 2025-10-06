describe('Login flow', () => {
  it('loads login page and submits form', () => {
    cy.intercept('GET', '**/api/public/tenant-meta', {
      statusCode: 200,
      body: {
        tenant_id: 'default',
        vertical: 'carwash',
        features: {},
        branding: {
          primaryColor: '#0052cc',
          secondaryColor: '#edf2ff',
          textColor: '#0b1d51',
        },
        name: 'Default Tenant',
        loyalty_type: 'points',
      },
    }).as('tenantMeta');

    cy.intercept('GET', '**/auth/me', {
      statusCode: 401,
      body: { detail: 'Not authenticated' },
    }).as('authMe');

    cy.intercept('POST', '**/auth/login', (req) => {
      const params = new URLSearchParams(req.body as string);
      expect(params.get('username')).to.eq('test@example.com');
      expect(params.get('password')).to.eq('password');
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
    cy.wait('@tenantMeta');
    cy.get('[data-cy="login-email"]').type('test@example.com');
    cy.get('[data-cy="login-password"]').type('password');
    cy.get('[data-cy="login-submit"]').click();
    cy.wait('@loginRequest');
    cy.location('pathname').should('eq', '/admin');
  });
});
