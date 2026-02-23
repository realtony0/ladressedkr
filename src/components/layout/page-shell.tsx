import { cn } from "@/lib/helpers/cn";

export function PageShell({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8", className)}>
      <div className="mb-6">
        <h1 className="font-title text-4xl text-[var(--color-dark-green)] md:text-5xl">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm text-[var(--color-black)]/70 md:text-base">{subtitle}</p> : null}
      </div>
      {children}
    </main>
  );
}
