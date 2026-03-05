import * as React from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "./utils";

function Avatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar"
      className={cn("relative flex size-10 shrink-0 overflow-hidden rounded-full bg-muted", className)}
      {...props}
    />
  );
}

type AvatarImageProps = Omit<ImageProps, "fill" | "alt"> & { alt?: string };

function AvatarImage({ className, alt = "", ...props }: AvatarImageProps) {
  return (
    <Image
      fill
      sizes="40px"
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      alt={alt}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-fallback"
      className={cn("bg-muted flex size-full items-center justify-center rounded-full", className)}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
