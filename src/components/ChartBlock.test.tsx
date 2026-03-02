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

  describe('chart without a title', () => {
    it('renders a bar chart without crashing when title is omitted', () => {
      const noTitle = JSON.stringify({
        type: 'bar',
        labels: ['A', 'B'],
        datasets: [{ label: 'val', data: [10, 20] }],
      });
      render(<ChartBlock content={noTitle} />);
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    it('renders a line chart without crashing when title is omitted', () => {
      const noTitle = JSON.stringify({
        type: 'line',
        labels: ['Mon', 'Tue'],
        datasets: [{ label: 'pace', data: [530, 520] }],
      });
      const { container } = render(<ChartBlock content={noTitle} />);
      expect(container.querySelector('table')).toBeInTheDocument();
    });
  });

  describe('multiple datasets', () => {
    it('shows a legend when a bar chart has more than one dataset', () => {
      const multi = JSON.stringify({
        type: 'bar',
        title: 'Comparison',
        labels: ['Week 1', 'Week 2'],
        datasets: [
          { label: 'Running', data: [20, 25] },
          { label: 'Cycling', data: [50, 60] },
        ],
      });
      render(<ChartBlock content={multi} />);
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Cycling')).toBeInTheDocument();
    });

    it('does not show a legend flex-wrap container for a single-dataset bar chart', () => {
      const { container } = render(<ChartBlock content={validBarChart} />);
      // Legend only renders when datasets.length > 1
      const legendContainer = container.querySelector('.flex.flex-wrap.gap-3');
      expect(legendContainer).not.toBeInTheDocument();
    });

    it('renders all dataset columns in a multi-dataset line chart table', () => {
      const multi = JSON.stringify({
        type: 'line',
        title: 'Heart Rate Zones',
        labels: ['Run 1', 'Run 2'],
        datasets: [
          { label: 'Avg HR', data: [148, 155] },
          { label: 'Max HR', data: [172, 180] },
        ],
      });
      render(<ChartBlock content={multi} />);
      expect(screen.getByText('Avg HR')).toBeInTheDocument();
      expect(screen.getByText('Max HR')).toBeInTheDocument();
      expect(screen.getByText('148')).toBeInTheDocument();
      expect(screen.getByText('180')).toBeInTheDocument();
    });
  });

  describe('bar chart with all-zero values', () => {
    it('renders without crashing when all data values are zero', () => {
      const allZero = JSON.stringify({
        type: 'bar',
        title: 'Empty Week',
        labels: ['Mon', 'Tue', 'Wed'],
        datasets: [{ label: 'miles', data: [0, 0, 0] }],
      });
      expect(() => render(<ChartBlock content={allZero} />)).not.toThrow();
      expect(screen.getByText('Empty Week')).toBeInTheDocument();
    });
  });
});
