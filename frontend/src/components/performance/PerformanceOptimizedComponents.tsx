'use client';

import { 
  memo, 
  useMemo, 
  useCallback, 
  useState, 
  useRef, 
  useEffect, 
  startTransition,
  lazy,
  Suspense
} from 'react';
import { FixedSizeList as List, VariableSizeList } from 'react-window';
import { 
  Card, 
  Text, 
  Stack, 
  Group, 
  Badge, 
  Skeleton, 
  Button,
  Progress,
  Box
} from '@mantine/core';
import { debounce } from 'lodash-es';

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    avgRenderTime: 0,
    lastRenderTime: 0,
    totalRenderTime: 0
  });
  
  const renderStartTime = useRef<number>(0);
  const updateMetrics = useRef(debounce((renderTime: number) => {
    setMetrics(prev => {
      const newRenderCount = prev.renderCount + 1;
      const newTotalTime = prev.totalRenderTime + renderTime;
      return {
        renderCount: newRenderCount,
        avgRenderTime: newTotalTime / newRenderCount,
        lastRenderTime: renderTime,
        totalRenderTime: newTotalTime
      };
    });
  }, 100));

  useEffect(() => {
    renderStartTime.current = performance.now();
    
    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      updateMetrics.current(renderTime);
      
      // Log performance warnings
      if (renderTime > 16) { // 60fps threshold
        console.warn(`${componentName} render exceeded 16ms: ${renderTime.toFixed(2)}ms`);
      }
    };
  });

  return metrics;
};

// Memoized list item component factory
export const createMemoizedListItem = <T,>(
  ItemComponent: React.ComponentType<{ item: T; index: number; style?: React.CSSProperties }>
) => {
  const MemoizedItem = memo<{ 
    index: number; 
    style: React.CSSProperties; 
    data: { items: T[]; onClick?: (item: T) => void } 
  }>(({ index, style, data }) => {
    const item = data.items[index];
    
    if (!item) {
      return (
        <div style={style}>
          <Skeleton height={60} />
        </div>
      );
    }

    return (
      <div style={style}>
        <ItemComponent 
          item={item} 
          index={index}
          style={style}
        />
      </div>
    );
  });

  MemoizedItem.displayName = `MemoizedListItem(${ItemComponent.displayName || ItemComponent.name})`;
  return MemoizedItem;
};

// High-performance virtualized list component
interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  onItemClick?: (item: T) => void;
  renderItem: React.ComponentType<{ item: T; index: number; style?: React.CSSProperties }>;
  containerHeight?: number;
  overscanCount?: number;
  className?: string;
  enablePerformanceMonitoring?: boolean;
}

export const VirtualizedList = memo(<T,>({
  items,
  itemHeight,
  onItemClick,
  renderItem: ItemComponent,
  containerHeight = 400,
  overscanCount = 3,
  className,
  enablePerformanceMonitoring = false
}: VirtualizedListProps<T>) => {
  const metrics = usePerformanceMonitor('VirtualizedList');
  const listRef = useRef<any>(null);
  
  const MemoizedItem = useMemo(() => 
    createMemoizedListItem(ItemComponent), 
    [ItemComponent]
  );

  const itemData = useMemo(() => ({
    items,
    onClick: onItemClick
  }), [items, onItemClick]);

  const handleItemClick = useCallback((item: T) => {
    startTransition(() => {
      onItemClick?.(item);
    });
  }, [onItemClick]);

  // Use fixed or variable size list based on itemHeight type
  const ListComponent = typeof itemHeight === 'function' ? VariableSizeList : List;

  return (
    <Box className={className}>
      {enablePerformanceMonitoring && process.env.NODE_ENV === 'development' && (
        <Card p="xs" mb="xs">
          <Group justify="space-between">
            <Text size="xs">Renders: {metrics.renderCount}</Text>
            <Text size="xs">Avg: {metrics.avgRenderTime.toFixed(1)}ms</Text>
            <Text size="xs">Last: {metrics.lastRenderTime.toFixed(1)}ms</Text>
          </Group>
        </Card>
      )}
      
      <ListComponent
        ref={listRef}
        height={containerHeight}
        itemCount={items.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={overscanCount}
        width="100%"
      >
        {MemoizedItem}
      </ListComponent>
    </Box>
  );
});

VirtualizedList.displayName = 'VirtualizedList';

// Performance optimized data table component
interface OptimizedDataTableProps<T> {
  data: T[];
  columns: Array<{
    key: keyof T;
    title: string;
    render?: (value: any, item: T) => React.ReactNode;
    width?: number;
    sortable?: boolean;
  }>;
  rowHeight?: number;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  pageSize?: number;
  enableVirtualization?: boolean;
}

export const OptimizedDataTable = memo(<T extends { id: string | number }>({
  data,
  columns,
  rowHeight = 50,
  onRowClick,
  loading = false,
  pageSize = 50,
  enableVirtualization = true
}: OptimizedDataTableProps<T>) => {
  const [sortConfig, setSortConfig] = useState<{ 
    key: keyof T; 
    direction: 'asc' | 'desc' 
  } | null>(null);

  // Memoized sorted data
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  // Memoized paginated data
  const paginatedData = useMemo(() => {
    return enableVirtualization ? sortedData : sortedData.slice(0, pageSize);
  }, [sortedData, pageSize, enableVirtualization]);

  const handleSort = useCallback((key: keyof T) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleRowClick = useCallback((item: T) => {
    startTransition(() => {
      onRowClick?.(item);
    });
  }, [onRowClick]);

  // Row component for virtualization
  const TableRow = memo<{ item: T; index: number; style?: React.CSSProperties }>(
    ({ item, index, style }) => (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--mantine-color-gray-3)',
          cursor: onRowClick ? 'pointer' : 'default',
          backgroundColor: index % 2 === 0 ? 'transparent' : 'var(--mantine-color-gray-0)'
        }}
        onClick={() => handleRowClick(item)}
      >
        {columns.map((column, colIndex) => {
          const value = item[column.key];
          const content = column.render ? column.render(value, item) : String(value);
          
          return (
            <div
              key={String(column.key)}
              style={{
                flex: column.width ? `0 0 ${column.width}px` : 1,
                padding: '8px 12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {content}
            </div>
          );
        })}
      </div>
    )
  );

  TableRow.displayName = 'TableRow';

  if (loading) {
    return (
      <Stack gap="xs">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} height={rowHeight} />
        ))}
      </Stack>
    );
  }

  return (
    <Card>
      {/* Header */}
      <div style={{ 
        display: 'flex',
        borderBottom: '2px solid var(--mantine-color-gray-4)',
        backgroundColor: 'var(--mantine-color-gray-1)',
        fontWeight: 600
      }}>
        {columns.map((column) => (
          <div
            key={String(column.key)}
            style={{
              flex: column.width ? `0 0 ${column.width}px` : 1,
              padding: '12px',
              cursor: column.sortable ? 'pointer' : 'default'
            }}
            onClick={() => column.sortable && handleSort(column.key)}
          >
            <Group gap="xs">
              <Text size="sm" fw={600}>{column.title}</Text>
              {column.sortable && sortConfig?.key === column.key && (
                <Text size="xs">
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </Text>
              )}
            </Group>
          </div>
        ))}
      </div>

      {/* Data rows */}
      {enableVirtualization ? (
        <VirtualizedList
          items={paginatedData}
          itemHeight={rowHeight}
          renderItem={TableRow}
          onItemClick={handleRowClick}
          containerHeight={Math.min(paginatedData.length * rowHeight + 100, 600)}
        />
      ) : (
        <div>
          {paginatedData.map((item, index) => (
            <TableRow 
              key={item.id} 
              item={item} 
              index={index}
            />
          ))}
        </div>
      )}

      {/* Performance info */}
      {process.env.NODE_ENV === 'development' && (
        <Text size="xs" c="dimmed" p="xs">
          Showing {paginatedData.length} of {data.length} items
          {enableVirtualization && ' (virtualized)'}
        </Text>
      )}
    </Card>
  );
});

OptimizedDataTable.displayName = 'OptimizedDataTable';

// Optimized search component with debouncing
interface OptimizedSearchProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
  clearOnSearch?: boolean;
}

export const OptimizedSearch = memo<OptimizedSearchProps>(({
  placeholder = 'Search...',
  onSearch,
  debounceMs = 300,
  clearOnSearch = false
}) => {
  const [value, setValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      startTransition(() => {
        onSearch(query);
        setIsSearching(false);
      });
    }, debounceMs),
    [onSearch, debounceMs]
  );

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setValue(newValue);
    setIsSearching(true);
    debouncedSearch(newValue);
  }, [debouncedSearch]);

  const handleClear = useCallback(() => {
    setValue('');
    setIsSearching(false);
    onSearch('');
  }, [onSearch]);

  return (
    <Group>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: '8px 12px',
          border: '1px solid var(--mantine-color-gray-4)',
          borderRadius: '4px'
        }}
      />
      {isSearching && <Text size="xs" c="dimmed">Searching...</Text>}
      {clearOnSearch && value && (
        <Button size="xs" variant="subtle" onClick={handleClear}>
          Clear
        </Button>
      )}
    </Group>
  );
});

OptimizedSearch.displayName = 'OptimizedSearch';

// Performance budget component
interface PerformanceBudgetProps {
  budgetMs: number;
  currentMs: number;
  componentName: string;
}

export const PerformanceBudget = memo<PerformanceBudgetProps>(({
  budgetMs,
  currentMs,
  componentName
}) => {
  const percentage = (currentMs / budgetMs) * 100;
  const isOverBudget = currentMs > budgetMs;

  return (
    <Card p="xs" withBorder>
      <Group justify="space-between" mb="xs">
        <Text size="xs" fw={500}>{componentName}</Text>
        <Badge 
          color={isOverBudget ? 'red' : percentage > 80 ? 'yellow' : 'green'}
          size="xs"
        >
          {currentMs.toFixed(1)}ms
        </Badge>
      </Group>
      <Progress
        value={Math.min(percentage, 100)}
        color={isOverBudget ? 'red' : percentage > 80 ? 'yellow' : 'green'}
        size="xs"
      />
      <Text size="xs" c="dimmed">
        Budget: {budgetMs}ms ({percentage.toFixed(0)}%)
      </Text>
    </Card>
  );
});

PerformanceBudget.displayName = 'PerformanceBudget';

// Lazy component wrapper with error boundary
export const LazyWrapper = memo<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
}>(({ children, fallback, errorFallback }) => (
  <Suspense 
    fallback={fallback || <Skeleton height={200} />}
  >
    <ErrorBoundary fallback={errorFallback}>
      {children}
    </ErrorBoundary>
  </Suspense>
));

LazyWrapper.displayName = 'LazyWrapper';

// Simple error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Card withBorder p="md">
          <Text c="red">Something went wrong. Please refresh the page.</Text>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default {
  VirtualizedList,
  OptimizedDataTable,
  OptimizedSearch,
  PerformanceBudget,
  LazyWrapper,
  usePerformanceMonitor,
  createMemoizedListItem
};