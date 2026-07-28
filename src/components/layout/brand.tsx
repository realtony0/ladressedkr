import Link from "next/link";

/**
 * Brand lockup: the "A" monogram badge + the wordmark.
 * Renders as a link by default (to `href`), or a plain span when `static` is set
 * (used on client menu pages where the brand should not be clickable).
 */
export function Brand({
  href = "/",
  size = "md",
  asLink = true,
}: {
  href?: string;
  size?: "sm" | "md";
  asLink?: boolean;
}) {
  const mark = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const text = size === "sm" ? "text-lg" : "text-xl sm:text-2xl";

  const content = (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-mark.png" alt="" className={`${mark} rounded-full`} />
      <span className={`font-logo leading-none text-[var(--color-dark-green)] ${text}`}>
        L’Aura Lounge
      </span>
    </span>
  );

  if (!asLink) {
    return content;
  }

  return (
    <Link href={href} className="min-w-0">
      {content}
    </Link>
  );
}
