import { describe, it, expect } from 'vitest';
import { formatDuration, metersToMiles } from './garmin';

// Pure utility functions — no mocking needed

describe('formatDuration', () => {
  it('returns "0s" for zero seconds', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatDuration(3661)).toBe('1h 1m 1s');
  });

  it('omits seconds when 0', () => {
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(120)).toBe('2m');
  });

  it('omits minutes when 0 but hours present', () => {
    expect(formatDuration(7201)).toBe('2h 1s');
  });
});

describe('metersToMiles', () => {
  it('converts exactly 1 mile worth of meters', () => {
    expect(metersToMiles(1609.344)).toBe(1);
  });

  it('rounds to 2 decimal places', () => {
    expect(metersToMiles(5000)).toBe(3.11);
    expect(metersToMiles(10000)).toBe(6.21);
  });

  it('returns 0 for 0 meters', () => {
    expect(metersToMiles(0)).toBe(0);
  });

  it('handles a marathon distance', () => {
    // 42195 metres = 26.22 miles
    expect(metersToMiles(42195)).toBe(26.22);
  });
});
