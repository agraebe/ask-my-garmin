/**
 * ChartBlock renders a structured chart from a JSON payload emitted by Claude
 * inside a fenced ```chart code block.
 *
 * Expected JSON shape:
 *   { type: "bar"|"line"|"doughnut", title?: string,
 *     labels: string[], datasets: [{ label: string, data: number[] }] }
 *
 * Bar charts are rendered as proportional CSS bars.
 * Line and doughnut types fall back to a readable data table.
 * Any malformed JSON renders as a plain code block (no crash).
 */
import type { ChartData } from '@/types';

function isChartData(obj: unknown): obj is ChartData {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    (o.type === 'bar' || o.type === 'line' || o.type === 'doughnut') &&
    Array.isArray(o.labels) &&
    Array.isArray(o.datasets)
  );
}

const COLORS = ['#007DC3', '#4BC56D', '#FF6B35', '#8FA8BF'] as const;

type Color = (typeof COLORS)[number];

function getColor(index: number): Color {
  return COLORS[index % COLORS.length] ?? COLORS[0];
}

interface ChartBlockProps {
  content: string;
}

export default function ChartBlock({ content }: ChartBlockProps) {
  let data: ChartData;

  try {
    const parsed: unknown = JSON.parse(content);
    if (!isChartData(parsed)) throw new Error('Invalid chart shape');
    data = parsed;
  } catch {
    // Graceful fallback — render raw JSON as a plain code block
    return (
      <pre className="mb-2 overflow-x-auto rounded-lg bg-garmin-bg p-3 font-mono text-sm text-garmin-text">
        {content}
      </pre>
    );
  }

  // Transform labels + datasets into rows: [{ name, [dsLabel]: value }]
  const rows = data.labels.map((label, i) => {
    const entry: Record<string, string | number> = { name: label };
    for (const ds of data.datasets) {
      entry[ds.label] = ds.data[i] ?? 0;
    }
    return entry;
  });

  const allValues = data.datasets.flatMap((ds) => ds.data);
  const maxValue = Math.max(...allValues, 1);

  if (data.type === 'bar') {
    return (
      <div className="mb-2 rounded-lg border border-garmin-border bg-garmin-surface p-4">
        {data.title && (
          <p className="mb-3 text-sm font-semibold text-garmin-text">{data.title}</p>
        )}
        <div className="space-y-3">
          {rows.map((row, ri) => (
            <div key={ri} className="flex items-start gap-3 text-xs">
              <span className="w-20 shrink-0 pt-0.5 text-right text-garmin-text-muted">
                {row.name}
              </span>
              <div className="flex-1 space-y-1">
                {data.datasets.map((ds, di) => {
                  const val = ds.data[ri] ?? 0;
                  const pct = Math.round((val / maxValue) * 100);
                  const color = getColor(di);
                  return (
                    <div key={ds.label} className="flex items-center gap-2">
                      <div
                        className="h-4 rounded"
                        style={{
                          width: `${pct}%`,
                          minWidth: val > 0 ? '4px' : '0',
                          backgroundColor: color,
                        }}
                      />
                      <span className="text-garmin-text-muted">{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {data.datasets.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {data.datasets.map((ds, di) => (
              <div key={ds.label} className="flex items-center gap-1 text-xs text-garmin-text-muted">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: getColor(di) }}
                />
                {ds.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Line and doughnut — render as a structured table (readable without a canvas library)
  return (
    <div className="mb-2 rounded-lg border border-garmin-border bg-garmin-surface p-4">
      {data.title && (
        <p className="mb-3 text-sm font-semibold text-garmin-text">{data.title}</p>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-garmin-border">
              <th className="pb-2 pr-4 text-left font-medium text-garmin-text-muted">Label</th>
              {data.datasets.map((ds) => (
                <th key={ds.label} className="pb-2 pr-4 text-left font-medium text-garmin-text-muted">
                  {ds.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-garmin-border last:border-0">
                <td className="py-1 pr-4 text-garmin-text">{row.name}</td>
                {data.datasets.map((ds) => (
                  <td key={ds.label} className="py-1 pr-4 text-garmin-text-muted">
                    {ds.data[ri] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
