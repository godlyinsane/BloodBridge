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
  window.history.pushState({}, '', '/');
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

test('renders brand title and hero section', () => {
  render(<App />);
  const brandElements = screen.getAllByText(/BloodBridge/i);
  expect(brandElements.length).toBeGreaterThan(0);
  expect(screen.getByText(/lifeline/i)).toBeInTheDocument();
});

test('renders theme toggle and toggles between dark and light mode', async () => {
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

test('loads /facilities directly when url starts at /facilities', async () => {
  window.history.pushState({}, '', '/facilities');
  await act(async () => {
    render(<App />);
  });

  const facilitiesNav = screen.getByRole('link', { name: /Blood Facilities/i });
  expect(facilitiesNav).toBeInTheDocument();
  expect(facilitiesNav).toHaveClass('active');
});

test('loads /about directly when url starts at /about', async () => {
  window.history.pushState({}, '', '/about');
  await act(async () => {
    render(<App />);
  });

  const aboutNav = screen.getByRole('link', { name: /About/i });
  expect(aboutNav).toBeInTheDocument();
  expect(aboutNav).toHaveClass('active');
});

test('loads /privacy and /terms without crashing', async () => {
  window.history.pushState({}, '', '/privacy');
  await act(async () => {
    render(<App />);
  });
  expect(screen.getByRole('heading', { name: /Privacy Policy/i })).toBeInTheDocument();

  cleanup();
  window.history.pushState({}, '', '/terms');
  await act(async () => {
    render(<App />);
  });
  expect(screen.getByRole('heading', { name: /Terms of Service/i })).toBeInTheDocument();
});
