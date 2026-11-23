import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { vi, test, expect, afterEach } from 'vitest';
import React from 'react';
import EmergencyBanner from './EmergencyBanner';
import P2PBloodListings from './P2PBloodListings';
import NearestBloodBankMap from './NearestBloodBankMap';

afterEach(() => {
  cleanup();
});

test('EmergencyBanner renders unified InstAmbulance dial link and blood bank button', () => {
  render(<EmergencyBanner />);
  const dialLink = screen.getByRole('link', { name: /Call InstAmbulance 108/i });
  expect(dialLink).toBeInTheDocument();
  expect(dialLink).toHaveAttribute('href', 'tel:108');

  const optionsBtn = screen.getByRole('button', { name: /Choose 102 or secondary ambulance/i });
  expect(optionsBtn).toBeInTheDocument();

  const nearestBankBtn = screen.getByRole('button', { name: /Take me to nearest blood bank/i });
  expect(nearestBankBtn).toBeInTheDocument();
});

test('P2PBloodListings renders blood group filter options and post button', () => {
  render(<P2PBloodListings apiBase="/api" />);
  expect(screen.getByText(/Live Donor & Availability Feed/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Upload Blood Availability/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'All Groups' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'O+' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'AB-' })).toBeInTheDocument();
});

test('NearestBloodBankMap renders GPS button and manual fallback search', () => {
  render(<NearestBloodBankMap apiBase="/api" />);
  expect(screen.getByRole('button', { name: /Use My Current Location/i })).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/Manual fallback: enter city/i)).toBeInTheDocument();
});
