import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowIcon } from "./icons";
import { cn } from "@/lib/utils";

/**
 * Primary gold CTA. Renders a next/link for internal routes and a plain
 * anchor for `tel:` / external hrefs.
 */
export default function GoldButton({
  href,
  children,
  icon,
  variant = "solid",
  className,
}: {
  href: string;
  children: ReactNode;
  /** Replaces the default arrow. */
  icon?: ReactNode;
  variant?: "solid" | "outline";
  className?: string;
}) {
  const classes = cn(
    "font-persian inline-flex items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-bold transition-all duration-300 ease-lux active:scale-[0.98] sm:text-base",
    variant === "solid"
      ? "bg-gradient-to-l from-gold-deep via-gold to-gold-soft text-ink-950 shadow-[0_10px_30px_-12px_rgb(212_175_55/70%)] hover:shadow-[0_14px_38px_-12px_rgb(212_175_55/90%)]"
      : "glass glass-gold text-gold-bright hover:border-gold-line-hi",
    className,
  );

  const content = (
    <>
      {children}
      {icon ?? <ArrowIcon className="h-4 w-4" />}
    </>
  );

  const isInternal = href.startsWith("/") || href.startsWith("#");

  return isInternal ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <a href={href} className={classes}>
      {content}
    </a>
  );
}
