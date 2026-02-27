import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuggestedQuestions from './SuggestedQuestions';

describe('SuggestedQuestions', () => {
  it('renders the app title', () => {
    render(<SuggestedQuestions onSelect={vi.fn()} />);
    expect(screen.getByText('Ask My Garmin')).toBeInTheDocument();
  });

  it('renders suggestion buttons', () => {
    render(<SuggestedQuestions onSelect={vi.fn()} />);
    expect(screen.getByText(/miles did I run/i)).toBeInTheDocument();
    expect(screen.getByText(/half marathon/i)).toBeInTheDocument();
    expect(screen.getByText(/sleep last night/i)).toBeInTheDocument();
  });

  it('calls onSelect with the exact question text when a suggestion is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SuggestedQuestions onSelect={onSelect} />);

    await user.click(screen.getByText('How many miles did I run this week?'));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('How many miles did I run this week?');
  });

  it('calls onSelect with the correct question for each button', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SuggestedQuestions onSelect={onSelect} />);

    await user.click(screen.getByText(/how did I sleep last night/i));
    expect(onSelect).toHaveBeenCalledWith(
      'How did I sleep last night and how is my recovery today?'
    );
  });

  describe('funMode', () => {
    it('shows RunningCircleJerk header when funMode is true', () => {
      render(<SuggestedQuestions onSelect={vi.fn()} funMode={true} />);
      expect(screen.getByText('RunningCircleJerk Mode')).toBeInTheDocument();
      expect(screen.queryByText('Ask My Garmin')).not.toBeInTheDocument();
    });

    it('shows RCJ subtitle when funMode is true', () => {
      render(<SuggestedQuestions onSelect={vi.fn()} funMode={true} />);
      expect(screen.getByText(/What does your Garmin say/i)).toBeInTheDocument();
    });

    it('renders RCJ questions instead of normal ones when funMode is true', () => {
      render(<SuggestedQuestions onSelect={vi.fn()} funMode={true} />);
      expect(screen.getByText(/Vaporfly/i)).toBeInTheDocument();
      expect(screen.getByText(/BQ by 8 seconds/i)).toBeInTheDocument();
      expect(screen.queryByText(/miles did I run/i)).not.toBeInTheDocument();
    });

    it('calls onSelect with the RCJ question text when clicked in funMode', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<SuggestedQuestions onSelect={onSelect} funMode={true} />);

      await user.click(screen.getByText(/forget to start my Garmin/i));
      expect(onSelect).toHaveBeenCalledWith(
        'If I do a run and forget to start my Garmin, did it still count?'
      );
    });

    it('shows normal questions when funMode is false (default)', () => {
      render(<SuggestedQuestions onSelect={vi.fn()} funMode={false} />);
      expect(screen.getByText('Ask My Garmin')).toBeInTheDocument();
      expect(screen.getByText(/miles did I run/i)).toBeInTheDocument();
      expect(screen.queryByText(/Vaporfly/i)).not.toBeInTheDocument();
    });
  });
});
