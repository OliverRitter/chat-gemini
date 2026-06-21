import React from "react";

const IMAGE_EXTENSIONS_REGEX = /\.(jpeg|jpg|gif|png|svg|webp)$/i;

export function renderContentTextOrMedia(content: string) {
  const isImageFile =
    IMAGE_EXTENSIONS_REGEX.test(content) ||
    content.startsWith("data:image/") ||
    content.includes("://unsplash.com");

  if (isImageFile) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-zinc-800 max-w-sm max-h-60 bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={content}
          alt="Shared attachment view"
          className="max-w-full h-auto max-h-60 block object-contain"
        />
      </div>
    );
  }
  return <p className="text-sm text-zinc-200 break-words">{content}</p>;
}
