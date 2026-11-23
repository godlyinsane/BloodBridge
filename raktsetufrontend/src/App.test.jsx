import { render, screen, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

const originalFetch = global.fetch;

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/admin');
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  });
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  window.history.pushState({}, '', '/');
});

test('opens the dedicated admin route at the admin login gate', () => {
  render(<App />);
  expect(screen.getByText('Admin access')).toBeInTheDocument();
  expect(screen.getByText(/Restricted to authorized administrators only/i)).toBeInTheDocument();
});
