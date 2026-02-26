import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import GarminStatus from './GarminStatus';

describe('GarminStatus', () => {
  it('shows a loading/connecting state initially', () => {
    render(<GarminStatus />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('shows "Connected" when the API returns connected: true', async () => {
    // Default MSW handler already returns connected: true
    render(<GarminStatus />);
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('shows "Not connected" when the API returns connected: false', async () => {
    server.use(
      http.get('/api/garmin/status', () =>
        HttpResponse.json({ connected: false, error: 'Invalid credentials' }, { status: 503 })
      )
    );
    render(<GarminStatus />);
    await waitFor(() => {
      expect(screen.getByText('Not connected')).toBeInTheDocument();
    });
  });

  it('shows "Not connected" on a network error', async () => {
    server.use(http.get('/api/garmin/status', () => HttpResponse.error()));
    render(<GarminStatus />);
    await waitFor(() => {
      expect(screen.getByText('Not connected')).toBeInTheDocument();
    });
  });
});
