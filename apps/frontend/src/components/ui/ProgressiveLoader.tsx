import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/useResponsive';

interface ProgressiveLoaderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  className?: string;
  priority?: 'high' | 'medium' | 'low';
}

export const ProgressiveLoader: React.FC<ProgressiveLoaderProps> = ({
  children,
  fallback,
  threshold = 0.1,
  rootMargin = '50px',
  className,
  priority = 'medium'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useResponsive();

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // For high priority items or mobile, load immediately
    if (priority === 'high' || isMobile) {
      setIsVisible(true);
      setIsLoaded(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Add a small delay for smooth loading
          setTimeout(() => setIsLoaded(true), 100);
          observer.unobserve(element);
        }
      },
      {
        threshold,
        rootMargin
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, priority, isMobile]);

  const defaultFallback = (
    <div className={cn(
      'animate-pulse bg-muted rounded-lg',
      isMobile ? 'h-24' : 'h-32',
      className
    )} />
  );

  return (
    <div
      ref={elementRef}
      className={cn(
        'transition-opacity duration-300',
        isLoaded ? 'opacity-100' : 'opacity-0',
        className
      )}
    >
      {isVisible ? (
        isLoaded ? children : (fallback || defaultFallback)
      ) : (
        fallback || defaultFallback
      )}
    </div>
  );
};

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  priority?: 'high' | 'medium' | 'low';
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  fallbackSrc,
  priority = 'medium',
  className,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(priority === 'high' ? src : '');
  const imgRef = useRef<HTMLImageElement>(null);
  const { isMobile } = useResponsive();

  useEffect(() => {
    const img = imgRef.current;
    if (!img || priority === 'high') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCurrentSrc(src);
          observer.unobserve(img);
        }
      },
      {
        threshold: 0.1,
        rootMargin: isMobile ? '100px' : '200px'
      }
    );

    observer.observe(img);

    return () => {
      observer.unobserve(img);
    };
  }, [src, priority, isMobile]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    }
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {!isLoaded && currentSrc && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}
      
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0',
          hasError && 'hidden'
        )}
        {...props}
      />
      
      {hasError && !fallbackSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
          <span className="text-sm">Failed to load image</span>
        </div>
      )}
    </div>
  );
};

interface LazyListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
  className?: string;
}

export function LazyList<T>({
  items,
  renderItem,
  itemHeight = 100,
  containerHeight = 400,
  overscan = 5,
  className
}: LazyListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const { isMobile } = useResponsive();

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div
      className={cn(
        'overflow-auto',
        isMobile && 'touch-manipulation',
        className
      )}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) =>
            renderItem(item, startIndex + index)
          )}
        </div>
      </div>
    </div>
  );
}