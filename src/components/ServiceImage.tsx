"use client";

import { parseImages, mainImage, PLACEHOLDER_IMAGE } from "@/lib/schedule";
import { LazyImage } from "@/components/LazyImage";

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
    <LazyImage
      src={src}
      alt={alt || "Service"}
      className={className}
      wrapperClassName="w-full h-full"
    />
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
        <LazyImage
          key={i}
          src={url}
          alt=""
          className="w-full h-28 object-cover rounded-lg"
          wrapperClassName="rounded-lg overflow-hidden"
        />
      ))}
    </div>
  );
}
