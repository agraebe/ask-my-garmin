export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChartDataset {
  label: string;
  data: number[];
}

export interface ChartData {
  type: 'bar' | 'line' | 'doughnut';
  title?: string;
  labels: string[];
  datasets: ChartDataset[];
}
