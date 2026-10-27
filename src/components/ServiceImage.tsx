"use client";

import { parseImages, mainImage, PLACEHOLDER_IMAGE } from "@/lib/schedule";

export function ServiceImage({
  imagesJson,
  mainIndex = 0,
  alt,
  className = "w-full h-40 object-cover",
}: {
  imagesJson?: string | null;
  mainIndex?: number;
  alt?: string;
  className?: string;
}) {
  const imgs = parseImages(imagesJson);
  const src = mainImage(imgs, mainIndex) || PLACEHOLDER_IMAGE;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt || "Service"} className={className} />
  );
}

export function ServiceGallery({
  imagesJson,
  mainIndex = 0,
}: {
  imagesJson?: string | null;
  mainIndex?: number;
}) {
  const imgs = parseImages(imagesJson);
  const list = imgs.length ? imgs : [PLACEHOLDER_IMAGE];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {list.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={url}
          alt=""
          className={`rounded-lg h-28 w-full object-cover border ${i === mainIndex ? "ring-2 ring-primary-500" : ""}`}
        />
      ))}
    </div>
  );
}
