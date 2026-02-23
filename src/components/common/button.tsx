"use client";

import * as React from "react";

import { cn } from "@/lib/helpers/cn";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-sage)] text-white hover:bg-[var(--color-dark-green)] disabled:bg-[var(--color-light-gray)] disabled:text-[var(--color-black)]",
  secondary:
    "bg-[var(--color-cream)] text-[var(--color-dark-green)] border border-[var(--color-sage)] hover:bg-[#ece7dd] disabled:opacity-60",
  danger:
    "bg-[#9C3D3D] text-white hover:bg-[#7c2f2f] disabled:opacity-60",
  ghost:
    "bg-transparent text-[var(--color-dark-green)] hover:bg-[var(--color-light-gray)] disabled:opacity-60",
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
