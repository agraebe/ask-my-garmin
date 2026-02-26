import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';
import DataExplorer from './DataExplorer';

const mockSyncData = {
  lastSyncTime: '2026-02-26T04:00:00Z',
  filesProcessed: {
    activities: 47,
    sleepFiles: 14,
    hrFiles: 30,
    trainingFiles: 15,
  },
  totalActivities: 247,
  dateRange: {
    earliest: '2025-11-27',
    latest: '2026-02-26',
  },
  errors: [
    'Sleep data partially corrupted for 2024-02-15',
    'HR data gap detected for 2024-02-10 14:00-16:00',
  ],
};

describe('DataExplorer', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    server.use(
      http.get('/api/garmin/sync', () => {
        return HttpResponse.json({ data: mockSyncData });
      })
    );
  });

  it('should not render when isOpen is false', () => {
    render(<DataExplorer isOpen={false} onClose={() => {}} />);
    
    expect(screen.queryByText('Garmin Data Explorer')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(<DataExplorer isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByText('Garmin Data Explorer')).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    render(<DataExplorer isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByText('Loading sync data...')).toBeInTheDocument();
  });

  it('should fetch and display sync data', async () => {
    render(<DataExplorer isOpen={true} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('Last Sync Summary')).toBeInTheDocument();
    });

    expect(screen.getByText('247')).toBeInTheDocument(); // Total activities
    expect(screen.getByText('47')).toBeInTheDocument(); // Activity files
    expect(screen.getByText('14')).toBeInTheDocument(); // Sleep files
  });

  it('should display file processing counts', async () => {
    render(<DataExplorer isOpen={true} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('Files Processed in Last Sync')).toBeInTheDocument();
    });

    expect(screen.getByText('Activity Files')).toBeInTheDocument();
    expect(screen.getByText('Sleep Files')).toBeInTheDocument();
    expect(screen.getByText('Heart Rate Files')).toBeInTheDocument();
    expect(screen.getByText('Training Files')).toBeInTheDocument();
  });

  it('should display data quality issues when present', async () => {
    render(<DataExplorer isOpen={true} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('Data Quality Issues')).toBeInTheDocument();
    });

    expect(screen.getByText(/Sleep data partially corrupted/)).toBeInTheDocument();
    expect(screen.getByText(/HR data gap detected/)).toBeInTheDocument();
  });

  it('should show available data types', async () => {
    render(<DataExplorer isOpen={true} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('Available Data Types')).toBeInTheDocument();
    });

    expect(screen.getByText('Activities & Performance')).toBeInTheDocument();
    expect(screen.getByText('Sleep & Recovery')).toBeInTheDocument();
    expect(screen.getByText('Heart Rate Zones')).toBeInTheDocument();
    expect(screen.getByText('Training Load & Stress')).toBeInTheDocument();
    expect(screen.getByText('Body Battery & HRV')).toBeInTheDocument();

    // Should show all as available
    const availableMarkers = screen.getAllByText('✓ Available');
    expect(availableMarkers).toHaveLength(5);
  });

  it('should call onClose when close button is clicked', async () => {
    const mockOnClose = vi.fn();
    render(<DataExplorer isOpen={true} onClose={mockOnClose} />);
    
    const closeButton = screen.getByText('×');
    await user.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('should show error state when API fails', async () => {
    server.use(
      http.get('/api/garmin/sync', () => {
        return HttpResponse.error();
      })
    );

    render(<DataExplorer isOpen={true} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch sync data')).toBeInTheDocument();
    });
  });

  it('should show error when no data is returned', async () => {
    server.use(
      http.get('/api/garmin/sync', () => {
        return HttpResponse.json({ data: null });
      })
    );

    render(<DataExplorer isOpen={true} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('No sync data available')).toBeInTheDocument();
    });
  });

  it('should format sync time correctly', async () => {
    render(<DataExplorer isOpen={true} onClose={() => {}} />);
    
    await waitFor(() => {
      // Should show formatted date/time
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });
  });

  it('should calculate date coverage correctly', async () => {
    render(<DataExplorer isOpen={true} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('Coverage:')).toBeInTheDocument();
      expect(screen.getByText(/\d+ days/)).toBeInTheDocument();
    });
  });

  it('should show privacy notice', async () => {
    render(<DataExplorer isOpen={true} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText(/This data is used to provide personalized training insights/)).toBeInTheDocument();
      expect(screen.getByText(/All data remains private/)).toBeInTheDocument();
    });
  });

  it('should not fetch data when not open', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    render(<DataExplorer isOpen={false} onClose={() => {}} />);
    
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should only fetch data when opened', async () => {
    const { rerender } = render(<DataExplorer isOpen={false} onClose={() => {}} />);
    
    const fetchSpy = vi.spyOn(global, 'fetch');
    
    rerender(<DataExplorer isOpen={true} onClose={() => {}} />);
    
    expect(fetchSpy).toHaveBeenCalledWith('/api/garmin/sync');
  });
});