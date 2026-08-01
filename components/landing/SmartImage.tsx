"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon } from "./icons";
import { cn } from "@/lib/utils";

/**
 * `next/image` that degrades to a styled glass placeholder when the file is
 * missing, so the page reads as intentional before any photography is
 * uploaded.
 *
 * `src` is always a plain string (never a static import) — a static import of
 * an absent file is a hard build error, which is exactly what we're avoiding.
 */
export default function SmartImage({
  src,
  alt,
  label,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  /** Persian caption shown on the placeholder. */
  label: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-800/60",
          className,
        )}
      >
        <ImageIcon className="h-9 w-9 text-gold/70" />
        <span className="font-persian text-xs text-white/45">{label}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}
