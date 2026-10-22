import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';

export default function PageTrend({ rows }) {
  if (!rows.length) {
    return (
      <Card className="p-5">
        <h2 className="font-space font-semibold text-sm text-muted-foreground mb-4">Page views</h2>
        <p className="text-sm text-muted-foreground">No daily Page readings yet.</p>
      </Card>
    );
  }

  const data = rows.map((row) => ({
    day: String(row.metric_date || '').slice(5),
    views: row.views || 0,
    unique: row.views_unique || 0,
    followers: row.followers || 0,
  }));

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-space font-semibold text-sm text-muted-foreground">Page views</h2>
        <span className="text-xs text-muted-foreground">
          {data[data.length - 1]?.followers || 0} followers
        </span>
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -18 }}>
            <defs>
              <linearGradient id="pageViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="views"
              name="Views"
              stroke="hsl(var(--primary))"
              fill="url(#pageViews)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="unique"
              name="Unique views"
              stroke="hsl(var(--neon-pink))"
              fill="transparent"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}