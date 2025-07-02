import React from 'react';

interface ImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  layout?: 'fixed' | 'fill' | 'intrinsic' | 'responsive';
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
  quality?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  loader?: ({ src, width, quality }: { src: string; width: number; quality?: number }) => string;
  unoptimized?: boolean;
  onLoad?: (event: any) => void;
  onError?: (event: any) => void;
  onLoadingComplete?: (result: { naturalWidth: number; naturalHeight: number }) => void;
  loading?: 'lazy' | 'eager';
  style?: React.CSSProperties;
  className?: string;
  fill?: boolean;
  sizes?: string;
}

const Image = React.forwardRef<HTMLImageElement, ImageProps>(
  ({ src, alt, width, height, fill, style, className, ...props }, ref) => {
    // Handle fill prop for Next.js 13+
    const imgStyle: React.CSSProperties = fill
      ? { position: 'absolute', height: '100%', width: '100%', left: 0, top: 0, right: 0, bottom: 0, ...style }
      : style || {};

    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        style={imgStyle}
        className={className}
        data-testid="next-image"
        data-nimg={fill ? 'fill' : '1'}
        {...props}
      />
    );
  }
);

Image.displayName = 'NextImage';

export default Image;