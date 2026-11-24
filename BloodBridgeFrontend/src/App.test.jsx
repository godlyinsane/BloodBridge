import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

const originalFetch = global.fetch;

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = MockIntersectionObserver;

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

test('renders theme toggle and toggles between dark and light mode', async () => {
  window.history.pushState({}, '', '/');
  render(<App />);

  const themeToggle = screen.getByRole('button', { name: /switch to (light|dark) mode/i });
  expect(themeToggle).toBeInTheDocument();
  expect(themeToggle).toHaveTextContent(/Light/i);

  await act(async () => {
    fireEvent.click(themeToggle);
  });

  expect(localStorage.getItem('bloodbridge-theme')).toBe('light');
  expect(themeToggle).toHaveTextContent(/Dark/i);
});

test('loads /facilities directly when url starts at /facilities', () => {
  window.history.pushState({}, '', '/facilities');
  render(<App />);

  // Should have "Blood Facilities" nav link active or facilities view content
  const facilitiesNav = screen.getByRole('link', { name: /Blood Facilities/i });
  expect(facilitiesNav).toBeInTheDocument();
  expect(facilitiesNav).toHaveClass('active');
});
