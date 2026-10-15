import type { ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  sizes?: string;
  unoptimized?: boolean;
  priority?: boolean;
};

export function Image({
  fill,
  className,
  alt = "",
  sizes: _sizes,
  unoptimized: _unoptimized,
  priority: _priority,
  ...rest
}: Props) {
  const classes = fill ? `absolute inset-0 h-full w-full ${className ?? ""}` : className;
  return <img alt={alt} className={classes} {...rest} />;
}
