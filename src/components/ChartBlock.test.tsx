import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChartBlock from './ChartBlock';

const validBarChart = JSON.stringify({
  type: 'bar',
  title: 'Weekly Distance (mi)',
  labels: ['Week 1', 'Week 2', 'Week 3'],
  datasets: [{ label: 'miles', data: [32, 28, 41] }],
});

const validLineChart = JSON.stringify({
  type: 'line',
  title: 'Pace Trend',
  labels: ['Mon', 'Wed', 'Fri'],
  datasets: [{ label: 'pace', data: [525, 540, 512] }],
});

const validDoughnutChart = JSON.stringify({
  type: 'doughnut',
  title: 'Activity Mix',
  labels: ['Run', 'Bike', 'Swim'],
  datasets: [{ label: 'count', data: [15, 5, 3] }],
});

describe('ChartBlock', () => {
  describe('bar chart', () => {
    it('renders the chart title', () => {
      render(<ChartBlock content={validBarChart} />);
      expect(screen.getByText('Weekly Distance (mi)')).toBeInTheDocument();
    });

    it('renders all labels', () => {
      render(<ChartBlock content={validBarChart} />);
      expect(screen.getByText('Week 1')).toBeInTheDocument();
      expect(screen.getByText('Week 2')).toBeInTheDocument();
      expect(screen.getByText('Week 3')).toBeInTheDocument();
    });

    it('renders data values', () => {
      render(<ChartBlock content={validBarChart} />);
      expect(screen.getByText('32')).toBeInTheDocument();
      expect(screen.getByText('28')).toBeInTheDocument();
      expect(screen.getByText('41')).toBeInTheDocument();
    });

    it('does not render a <pre> fallback for valid data', () => {
      const { container } = render(<ChartBlock content={validBarChart} />);
      expect(container.querySelector('pre')).not.toBeInTheDocument();
    });
  });

  describe('line chart (table fallback)', () => {
    it('renders title and a data table', () => {
      render(<ChartBlock content={validLineChart} />);
      expect(screen.getByText('Pace Trend')).toBeInTheDocument();
      const { container } = render(<ChartBlock content={validLineChart} />);
      expect(container.querySelector('table')).toBeInTheDocument();
    });

    it('shows all labels in the table', () => {
      render(<ChartBlock content={validLineChart} />);
      expect(screen.getAllByText('Mon').length).toBeGreaterThan(0);
    });
  });

  describe('doughnut chart (table fallback)', () => {
    it('renders a table with labels and values', () => {
      const { container } = render(<ChartBlock content={validDoughnutChart} />);
      expect(container.querySelector('table')).toBeInTheDocument();
      expect(screen.getByText('Activity Mix')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('falls back to <pre> on malformed JSON', () => {
      const { container } = render(<ChartBlock content="{invalid json" />);
      expect(container.querySelector('pre')).toBeInTheDocument();
      expect(screen.getByText('{invalid json')).toBeInTheDocument();
    });

    it('falls back to <pre> when JSON has invalid shape (missing type)', () => {
      const bad = JSON.stringify({ labels: ['A', 'B'], datasets: [] });
      const { container } = render(<ChartBlock content={bad} />);
      expect(container.querySelector('pre')).toBeInTheDocument();
    });

    it('falls back to <pre> when JSON has invalid type value', () => {
      const bad = JSON.stringify({ type: 'pie', labels: ['A'], datasets: [] });
      const { container } = render(<ChartBlock content={bad} />);
      expect(container.querySelector('pre')).toBeInTheDocument();
    });

    it('does not throw when datasets have missing data points', () => {
      const sparse = JSON.stringify({
        type: 'bar',
        labels: ['A', 'B', 'C'],
        datasets: [{ label: 'val', data: [10] }], // missing data for B and C
      });
      expect(() => render(<ChartBlock content={sparse} />)).not.toThrow();
    });
  });
});
