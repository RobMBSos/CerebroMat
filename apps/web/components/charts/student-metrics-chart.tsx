'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SeriesPoint = {
  period: string;
  accuracy?: number;
  avgResponseSeconds?: number;
  avgLevel?: number;
};

type Metric = 'accuracy' | 'avgResponseSeconds' | 'avgLevel';

function formatMetricValue(metric: Metric, value: number): string {
  if (metric === 'accuracy') {
    return `${Math.round(value * 100)}%`;
  }

  if (metric === 'avgResponseSeconds') {
    return `${value.toFixed(1)} s`;
  }

  return value.toFixed(2);
}

function metricLabel(metric: Metric): string {
  if (metric === 'accuracy') return 'Precisión';
  if (metric === 'avgResponseSeconds') return 'Tiempo medio';
  return 'Nivel medio';
}

export function StudentMetricsChart({
  title,
  description,
  color,
  data,
  metric,
  yDomain,
}: {
  title: string;
  description: string;
  color: string;
  metric: Metric;
  data: SeriesPoint[];
  yDomain?: [number, number];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="var(--chart-grid)" />
              <XAxis dataKey="period" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
              <YAxis
                domain={yDomain}
                tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                tickFormatter={(value) => formatMetricValue(metric, Number(value))}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--chart-tooltip-bg)',
                  borderColor: 'var(--chart-tooltip-border)',
                  borderRadius: '0.75rem',
                }}
                labelStyle={{ color: 'var(--chart-axis)' }}
                formatter={(value) => [
                  formatMetricValue(metric, Number(value ?? 0)),
                  metricLabel(metric),
                ]}
              />
              <Line type="monotone" dataKey={metric} stroke={color} strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
