import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';

const shorten = (value) => (value.length > 44 ? `${value.slice(0, 44)}…` : value);

export default function TopicPerformance({ rows }) {
  if (!rows.length) return null;

  const data = rows.slice(0, 8).map((row) => ({
    topic: shorten(String(row.topic)),
    views: row.sum_views || 0,
    posts: row.count || 0,
  }));

  return (
    <Card className="p-5">
      <h2 className="font-space font-semibold text-sm text-muted-foreground mb-4">Views by topic</h2>
      <div style={{ height: Math.max(200, data.length * 44) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="topic"
              width={170}
              tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Bar dataKey="views" name="Views" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Each post's Facebook media views, grouped by the researched topic it was built on.
      </p>
    </Card>
  );
}