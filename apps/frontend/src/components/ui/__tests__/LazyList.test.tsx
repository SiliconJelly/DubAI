import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LazyList, useLazyLoad } from '../LazyList';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LazyList', () => {
  const mockItems = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: i * 10
  }));

  const renderItem = (item: any, index: number) => (
    <div key={item.id} data-testid={`item-${item.id}`}>
      {item.name} - {item.value}
    </div>
  );

  it('should render visible items only', () => {
    render(
      <LazyList
        items={mockItems}
        renderItem={renderItem}
        itemHeight={50}
        containerHeight={200}
        overscan={2}
      />
    );

    // Should render only visible items plus overscan
    // With 200px container and 50px items, we see 4 items + 2 overscan on each side = 8 items
    const visibleItems = screen.getAllByTestId(/item-/);
    expect(visibleItems.length).toBeLessThanOrEqual(8);
  });

  it('should render empty component when no items', () => {
    render(
      <LazyList
        items={[]}
        renderItem={renderItem}
        emptyComponent={<div data-testid="empty">No items</div>}
      />
    );

    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });

  it('should show loading component when loading', () => {
    render(
      <LazyList
        items={mockItems}
        renderItem={renderItem}
        isLoading={true}
        loadingComponent={<div data-testid="loading">Loading...</div>}
      />
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should call onLoadMore when scrolled near bottom', async () => {
    const onLoadMore = vi.fn();
    
    render(
      <LazyList
        items={mockItems.slice(0, 20)}
        renderItem={renderItem}
        itemHeight={50}
        containerHeight={200}
        onLoadMore={onLoadMore}
        hasMore={true}
      />
    );

    const container = screen.getByTestId('lazy-list-container');
    
    // Mock scroll properties
    Object.defineProperty(container, 'scrollTop', { value: 800, writable: true });
    Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true });
    Object.defineProperty(container, 'clientHeight', { value: 200, writable: true });
    
    // Simulate scroll event
    fireEvent.scroll(container);

    await waitFor(() => {
      expect(onLoadMore).toHaveBeenCalled();
    });
  });
});

describe('useLazyLoad', () => {
  const mockFetchPage = vi.fn();

  beforeEach(() => {
    mockFetchPage.mockClear();
  });

  it('should load initial data', async () => {
    mockFetchPage.mockResolvedValue({
      items: [{ id: 1, name: 'Item 1' }],
      hasMore: true
    });

    const TestComponent = () => {
      const { items, loadMore, isLoading } = useLazyLoad({
        fetchPage: mockFetchPage
      });

      React.useEffect(() => {
        loadMore();
      }, []);

      return (
        <div>
          {items.map(item => (
            <div key={item.id} data-testid={`item-${item.id}`}>
              {item.name}
            </div>
          ))}
          {isLoading && <div data-testid="loading">Loading...</div>}
        </div>
      );
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
    });

    expect(mockFetchPage).toHaveBeenCalledWith(1, 20);
  });

  it('should load more data when requested', async () => {
    mockFetchPage
      .mockResolvedValueOnce({
        items: [{ id: 1, name: 'Item 1' }],
        hasMore: true
      })
      .mockResolvedValueOnce({
        items: [{ id: 2, name: 'Item 2' }],
        hasMore: false
      });

    const TestComponent = () => {
      const { items, loadMore, isLoading, hasMore } = useLazyLoad({
        fetchPage: mockFetchPage
      });

      const handleLoadMore = () => {
        if (!isLoading && hasMore) {
          loadMore();
        }
      };

      return (
        <div>
          {items.map(item => (
            <div key={item.id} data-testid={`item-${item.id}`}>
              {item.name}
            </div>
          ))}
          <button onClick={handleLoadMore} data-testid="load-more">
            Load More
          </button>
        </div>
      );
    };

    render(<TestComponent />);

    // First load
    fireEvent.click(screen.getByTestId('load-more'));
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
    });

    // Second load
    fireEvent.click(screen.getByTestId('load-more'));
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toBeInTheDocument();
    });

    expect(mockFetchPage).toHaveBeenCalledTimes(2);
    expect(mockFetchPage).toHaveBeenNthCalledWith(1, 1, 20);
    expect(mockFetchPage).toHaveBeenNthCalledWith(2, 2, 20);
  });
});