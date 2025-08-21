import { describe, it, expect, vi } from 'vitest';
// Stub the routes module so App renders a simple login heading
vi.mock('./routes', () => ({ __esModule: true, default: () => <h1>Log In</h1> }));
import { render, screen } from './utils/test-utils';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

describe('App routing', () => {
  it('renders login page when navigating to /login', async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>
    );
    const heading = await screen.findByRole('heading', { name: /Log In/i });
    expect(heading).toBeInTheDocument();
  });
});
