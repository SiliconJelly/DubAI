import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface LazyListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
  className?: string;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export function LazyList<T>({
  items,
  renderItem,
  itemHeight = 80,
  containerHeight = 400,
  overscan = 5,
  className,
  loadingComponent,
  emptyComponent,
  onLoadMore,
  hasMore = false,
  isLoading = false
}: LazyListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const loadMoreTriggered = useRef(false);

  const totalHeight = items.length * itemHeight;
  const viewportHeight = containerHeight;
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + viewportHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);

    // Trigger load more when near bottom
    if (onLoadMore && hasMore && !isLoading && !loadMoreTriggered.current) {
      const { scrollTop, scrollHeight, clientHeight } = target;
      const threshold = 200; // Load more when 200px from bottom
      
      if (scrollTop + clientHeight >= scrollHeight - threshold) {
        loadMoreTriggered.current = true;
        onLoadMore();
      }
    }
  }, [onLoadMore, hasMore, isLoading]);

  // Reset load more trigger when loading completes
  useEffect(() => {
    if (!isLoading) {
      loadMoreTriggered.current = false;
    }
  }, [isLoading]);

  if (items.length === 0 && !isLoading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height: containerHeight }}>
        {emptyComponent || <p className="text-muted-foreground">No items to display</p>}
      </div>
    );
  }

  return (
    <div
      ref={setContainerRef}
      className={cn('overflow-auto', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
      data-testid="lazy-list-container"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${startIndex * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
              className="flex items-center"
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
          
          {/* Loading indicator at bottom */}
          {isLoading && (
            <div 
              className="flex items-center justify-center py-4"
              style={{ height: itemHeight }}
            >
              {loadingComponent || (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm text-muted-foreground">Loading more...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook for managing paginated data with lazy loading
export interface UseLazyLoadOptions<T> {
  pageSize?: number;
  initialData?: T[];
  fetchPage: (page: number, pageSize: number) => Promise<{ items: T[]; hasMore: boolean }>;
}

export function useLazyLoad<T>({ 
  pageSize = 20, 
  initialData = [], 
  fetchPage 
}: UseLazyLoadOptions<T>) {
  const [items, setItems] = useState<T[]>(initialData);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchPage(currentPage + 1, pageSize);
      
      setItems(prev => [...prev, ...result.items]);
      setCurrentPage(prev => prev + 1);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more items'));
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, fetchPage, isLoading, hasMore]);

  const reset = useCallback(() => {
    setItems(initialData);
    setCurrentPage(0);
    setHasMore(true);
    setIsLoading(false);
    setError(null);
  }, [initialData]);

  const refresh = useCallback(async () => {
    setItems([]);
    setCurrentPage(0);
    setHasMore(true);
    setError(null);
    
    setIsLoading(true);
    try {
      const result = await fetchPage(1, pageSize);
      setItems(result.items);
      setCurrentPage(1);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh items'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, pageSize]);

  return {
    items,
    hasMore,
    isLoading,
    error,
    loadMore,
    reset,
    refresh
  };
}

export default LazyList;