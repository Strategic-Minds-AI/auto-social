import { Card } from '@/components/ui/card';

export default function PostPerformanceTable({ posts }) {
  if (!posts.length) return null;

  return (
    <Card className="p-5">
      <h2 className="font-space font-semibold text-sm text-muted-foreground mb-4">Top posts</h2>
      <div className="space-y-3">
        {posts.slice(0, 8).map((post) => (
          <div
            key={post.id}
            className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-sm line-clamp-2">{post.caption_excerpt || 'No caption'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {post.topic || 'Not linked to a planned post'}
                {post.pillar ? ` · ${post.pillar}` : ''}
                {post.metric_date ? ` · ${post.metric_date}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-space font-semibold text-sm">{post.views ?? '—'}</p>
              <p className="text-xs text-muted-foreground">views</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}