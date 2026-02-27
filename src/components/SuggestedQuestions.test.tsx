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
});

describe('SuggestedQuestions in fun mode', () => {
  it('renders the RunBot 9000 title', () => {
    render(<SuggestedQuestions onSelect={vi.fn()} funMode={true} />);
    expect(screen.getByText('RunBot 9000')).toBeInTheDocument();
  });

  it('renders the fun mode subtitle', () => {
    render(<SuggestedQuestions onSelect={vi.fn()} funMode={true} />);
    expect(
      screen.getByText("What does your Garmin say? (It's probably fine.)")
    ).toBeInTheDocument();
  });

  it('renders RCJ suggestion buttons', () => {
    render(<SuggestedQuestions onSelect={vi.fn()} funMode={true} />);
    expect(screen.getByText(/Vaporfly/i)).toBeInTheDocument();
    expect(screen.getByText(/BQ by 8 seconds/i)).toBeInTheDocument();
    expect(screen.getByText(/forget to start my Garmin/i)).toBeInTheDocument();
  });

  it('does not render normal suggestions in fun mode', () => {
    render(<SuggestedQuestions onSelect={vi.fn()} funMode={true} />);
    expect(screen.queryByText(/half marathon/i)).not.toBeInTheDocument();
  });

  it('calls onSelect with an RCJ question when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SuggestedQuestions onSelect={onSelect} funMode={true} />);

    await user.click(screen.getByText(/forget to start my Garmin/i));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(
      "If I do a run and forget to start my Garmin, did it still count?"
    );
  });
});
