export default function GrowthStep({ index, step, detail }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex gap-3">
      <span className="w-6 h-6 rounded-md bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
        {index}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{step}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}