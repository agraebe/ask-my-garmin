export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export type MemoryCategory = 'race_event' | 'goal' | 'injury' | 'training_context' | 'personal';

export interface Memory {
  id: string;
  key: string;
  content: string;
  category: MemoryCategory;
  created_at: string;
  updated_at: string;
  source_context: string;
}

export interface MemoryStoredEvent {
  id: string;
  key: string;
  content: string;
  updated: boolean;
  action: string;
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
