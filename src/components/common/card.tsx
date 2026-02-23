import { cn } from "@/lib/helpers/cn";

export function Card({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn("rounded-2xl border border-[var(--color-light-gray)] bg-white p-4 shadow-sm", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("font-title text-2xl text-[var(--color-dark-green)]", className)}>{children}</h3>;
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[var(--color-cream)] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[var(--color-dark-green)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn("bg-white", className)}>
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-dark-green)]/70">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-[var(--color-dark-green)]">{value}</p>
      {hint ? <p className="mt-2 text-xs text-[var(--color-black)]/60">{hint}</p> : null}
    </Card>
  );
}
