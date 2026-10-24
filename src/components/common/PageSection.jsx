export default function PageSection({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-space font-semibold text-lg flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" /> {title}
        </h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}