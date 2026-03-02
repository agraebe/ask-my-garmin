import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import MemoryPanel from './MemoryPanel';

// Seed sessionStorage with a fake session token before each test
beforeEach(() => {
  sessionStorage.setItem('garmin_session', 'fake-token');
});

describe('MemoryPanel', () => {
  it('renders the panel heading', async () => {
    render(<MemoryPanel onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText("Coach's Memory")).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<MemoryPanel onClose={vi.fn()} />);
    expect(screen.getByText('Loading memories…')).toBeInTheDocument();
  });

  it('renders the list of memories after loading', async () => {
    render(<MemoryPanel onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Next Marathon')).toBeInTheDocument();
    });
    expect(screen.getByText('Boston Marathon on April 21, 2026')).toBeInTheDocument();
    expect(screen.getByText('Race Event')).toBeInTheDocument();
  });

  it('shows empty state when no memories exist', async () => {
    server.use(http.get('/api/memories', () => HttpResponse.json({ memories: [] })));
    render(<MemoryPanel onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/No memories yet/)).toBeInTheDocument();
    });
  });

  it('shows error state when API fails', async () => {
    server.use(
      http.get('/api/memories', () => new HttpResponse(null, { status: 500 }))
    );
    render(<MemoryPanel onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MemoryPanel onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close memory panel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onMemoryCountChange with count after loading', async () => {
    const onMemoryCountChange = vi.fn();
    render(<MemoryPanel onClose={vi.fn()} onMemoryCountChange={onMemoryCountChange} />);
    await waitFor(() => {
      expect(onMemoryCountChange).toHaveBeenCalledWith(1);
    });
  });

  it('shows edit form when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<MemoryPanel onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Next Marathon'));
    await user.click(screen.getByRole('button', { name: 'Edit Next Marathon' }));
    expect(screen.getByPlaceholderText('Label')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Detail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows delete confirmation when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<MemoryPanel onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Next Marathon'));
    await user.click(screen.getByRole('button', { name: 'Delete Next Marathon' }));
    expect(screen.getByText(/Delete.*Next Marathon/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('cancels delete confirmation', async () => {
    const user = userEvent.setup();
    render(<MemoryPanel onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Next Marathon'));
    await user.click(screen.getByRole('button', { name: 'Delete Next Marathon' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Next Marathon')).toBeInTheDocument();
  });

  it('shows memory count badge when memories exist', async () => {
    render(<MemoryPanel onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MemoryPanel onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    await user.click(dialog);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
