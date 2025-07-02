'use client';

import { useState, useEffect, useRef, memo, forwardRef } from 'react';
import Image, { ImageProps } from 'next/image';
import { Box, Skeleton, Center, Text } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';

interface OptimizedImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  fallbackSrc?: string;
  showSkeleton?: boolean;
  skeletonHeight?: number;
  enableLazyLoading?: boolean;
  priority?: boolean;
  onLoadComplete?: () => void;
  onLoadError?: (error: Error) => void;
}

// Intersection Observer hook for lazy loading
const useIntersectionObserver = (
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {},
  enable = true
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (!enable || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, enable, options]);

  return isIntersecting;
};

const OptimizedImage = memo(forwardRef<HTMLDivElement, OptimizedImageProps>(({
  src,
  alt,
  fallbackSrc,
  showSkeleton = true,
  skeletonHeight = 200,
  enableLazyLoading = true,
  priority = false,
  onLoadComplete,
  onLoadError,
  className,
  style,
  ...imageProps
}, ref) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [imageSrc, setImageSrc] = useState(src);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use intersection observer for lazy loading
  const isInView = useIntersectionObserver(
    containerRef,
    { threshold: 0.1, rootMargin: '50px' },
    enableLazyLoading && !priority
  );

  // Determine if image should load
  const shouldLoad = priority || !enableLazyLoading || isInView;

  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true);
    onLoadComplete?.();
  };

  // Handle image error
  const handleError = () => {
    setIsError(true);
    
    if (fallbackSrc && imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
      setIsError(false);
    } else {
      const error = new Error(`Failed to load image: ${src}`);
      onLoadError?.(error);
    }
  };

  // Preload critical images
  useEffect(() => {
    if (priority && typeof src === 'string') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [src, priority]);

  // Reset state when src changes
  useEffect(() => {
    setIsLoaded(false);
    setIsError(false);
    setImageSrc(src);
  }, [src]);

  return (
    <Box
      ref={ref || containerRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Loading skeleton */}
      {showSkeleton && !isLoaded && !isError && (
        <Skeleton
          height={skeletonHeight}
          radius="md"
          style={{
            position: shouldLoad ? 'absolute' : 'static',
            top: 0,
            left: 0,
            right: 0,
            zIndex: shouldLoad ? 1 : undefined,
          }}
        />
      )}

      {/* Error state */}
      {isError && !fallbackSrc && (
        <Center
          style={{
            height: skeletonHeight,
            backgroundColor: 'var(--mantine-color-gray-1)',
            borderRadius: 'var(--mantine-radius-md)',
          }}
        >
          <Box style={{ textAlign: 'center' }}>
            <IconPhoto size={48} color="var(--mantine-color-gray-5)" />
            <Text size="sm" c="dimmed" mt="xs">
              Failed to load image
            </Text>
          </Box>
        </Center>
      )}

      {/* Actual image */}
      {shouldLoad && !isError && (
        <Image
          {...imageProps}
          src={imageSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
            zIndex: 2,
            position: 'relative',
            ...imageProps.style,
          }}
          // Performance optimizations
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          // Responsive images
          sizes={imageProps.sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
        />
      )}

      {/* Lazy loading placeholder */}
      {enableLazyLoading && !priority && !isInView && (
        <Box
          style={{
            height: skeletonHeight,
            backgroundColor: 'var(--mantine-color-gray-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--mantine-radius-md)',
          }}
        >
          <Text size="sm" c="dimmed">
            Loading...
          </Text>
        </Box>
      )}
    </Box>
  );
}));

OptimizedImage.displayName = 'OptimizedImage';

// Utility component for avatar images with fallback
export const OptimizedAvatar = memo<{
  src?: string;
  alt: string;
  size?: number;
  fallbackInitials?: string;
  className?: string;
}>(({ src, alt, size = 48, fallbackInitials, className }) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <Box
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: 'var(--mantine-color-blue-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: size * 0.4,
          fontWeight: 600,
        }}
      >
        {fallbackInitials || alt.charAt(0).toUpperCase()}
      </Box>
    );
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{
        borderRadius: '50%',
        objectFit: 'cover',
      }}
      onLoadError={() => setHasError(true)}
      priority={size > 100} // Prioritize larger avatars
      skeletonHeight={size}
    />
  );
});

OptimizedAvatar.displayName = 'OptimizedAvatar';

// Utility component for responsive hero images
export const OptimizedHeroImage = memo<{
  src: string;
  alt: string;
  aspectRatio?: number;
  className?: string;
}>(({ src, alt, aspectRatio = 16/9, className }) => {
  return (
    <Box
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: aspectRatio.toString(),
      }}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        style={{
          objectFit: 'cover',
        }}
        priority
        sizes="100vw"
        enableLazyLoading={false}
      />
    </Box>
  );
});

OptimizedHeroImage.displayName = 'OptimizedHeroImage';

export default OptimizedImage;