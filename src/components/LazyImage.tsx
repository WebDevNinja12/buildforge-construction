"use client";

import { useState } from "react";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  /** Extra classes for the outer frame (e.g. absolute inset-0) */
  wrapperClassName?: string;
  /** Show soft pulse skeleton until load */
  skeleton?: boolean;
};

/**
 * Lazy-loads images with native loading="lazy" and a fade-in once ready.
 */
export function LazyImage({
  src,
  alt = "",
  className = "",
  wrapperClassName = "",
  skeleton = true,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className={`bg-slate-100 ${wrapperClassName || className}`} aria-hidden />;
  }

  return (
    <div className={`relative overflow-hidden ${wrapperClassName}`}>
      {skeleton && !loaded && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 animate-pulse"
          aria-hidden
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`${className} transition-opacity duration-500 ease-out ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
