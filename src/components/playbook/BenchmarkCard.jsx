export default function BenchmarkCard({ name, what, how, takeaway }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <p className="text-sm font-medium">{name}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{what}</p>
      <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-3">{how}</p>
      <p className="text-xs text-primary/90 leading-relaxed">{takeaway}</p>
    </div>
  );
}