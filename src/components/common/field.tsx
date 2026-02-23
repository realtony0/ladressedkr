import * as React from "react";

import { cn } from "@/lib/helpers/cn";

export function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn("mb-1 block text-sm font-semibold text-[var(--color-dark-green)]", className)}>{children}</label>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-[var(--color-light-gray)] bg-white px-3 py-2 text-sm text-[var(--color-black)] outline-none transition-colors",
        "focus:border-[var(--color-sage)] focus:ring-2 focus:ring-[var(--color-sage)]/20",
        props.className,
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-xl border border-[var(--color-light-gray)] bg-white px-3 py-2 text-sm text-[var(--color-black)] outline-none transition-colors",
        "focus:border-[var(--color-sage)] focus:ring-2 focus:ring-[var(--color-sage)]/20",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-xl border border-[var(--color-light-gray)] bg-white px-3 py-2 text-sm text-[var(--color-black)] outline-none transition-colors",
        "focus:border-[var(--color-sage)] focus:ring-2 focus:ring-[var(--color-sage)]/20",
        props.className,
      )}
    />
  );
}
