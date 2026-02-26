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
    expect(screen.getByText(/steps did I take/i)).toBeInTheDocument();
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

    await user.click(screen.getByText('How did I sleep last night?'));
    expect(onSelect).toHaveBeenCalledWith('How did I sleep last night?');
  });
});
