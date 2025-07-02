import React from 'react';

// Mock query client
export class QueryClient {
  constructor(config?: any) {
    this.defaultOptions = config?.defaultOptions || {};
    this.queryCache = new QueryCache();
    this.mutationCache = new MutationCache();
  }

  defaultOptions: any;
  queryCache: QueryCache;
  mutationCache: MutationCache;

  // Query methods
  getQueryData = jest.fn((queryKey: any) => undefined);
  setQueryData = jest.fn((queryKey: any, data: any) => data);
  invalidateQueries = jest.fn().mockResolvedValue(undefined);
  refetchQueries = jest.fn().mockResolvedValue([]);
  removeQueries = jest.fn();
  resetQueries = jest.fn().mockResolvedValue(undefined);
  cancelQueries = jest.fn().mockResolvedValue(undefined);
  
  // Mutation methods
  setMutationDefaults = jest.fn();
  getMutationDefaults = jest.fn().mockReturnValue({});
  
  // Cache methods
  clear = jest.fn();
  
  // State methods
  isFetching = jest.fn().mockReturnValue(0);
  isMutating = jest.fn().mockReturnValue(0);
  
  // Query state
  getQueryState = jest.fn().mockReturnValue(undefined);
  
  // Prefetch
  prefetchQuery = jest.fn().mockResolvedValue(undefined);
  fetchQuery = jest.fn().mockResolvedValue(undefined);
  
  // Default mutation function
  setDefaultOptions = jest.fn();
  getDefaultOptions = jest.fn().mockReturnValue({});
  
  // Mount/unmount
  mount = jest.fn();
  unmount = jest.fn();
}

// Mock query cache
export class QueryCache {
  constructor(config?: any) {
    this.config = config || {};
  }
  
  config: any;
  
  find = jest.fn().mockReturnValue(undefined);
  findAll = jest.fn().mockReturnValue([]);
  subscribe = jest.fn().mockReturnValue(() => {});
  clear = jest.fn();
  
  // Event methods
  onError = jest.fn();
  onSuccess = jest.fn();
  onSettled = jest.fn();
}

// Mock mutation cache
export class MutationCache {
  constructor(config?: any) {
    this.config = config || {};
  }
  
  config: any;
  
  find = jest.fn().mockReturnValue(undefined);
  findAll = jest.fn().mockReturnValue([]);
  subscribe = jest.fn().mockReturnValue(() => {});
  clear = jest.fn();
  
  // Event methods
  onError = jest.fn();
  onSuccess = jest.fn();
  onSettled = jest.fn();
}

// Create context
const QueryClientContext = React.createContext<QueryClient | undefined>(undefined);

// QueryClientProvider component
interface QueryClientProviderProps {
  client: QueryClient;
  children: React.ReactNode;
}

export const QueryClientProvider: React.FC<QueryClientProviderProps> = ({ client, children }) => {
  return (
    <QueryClientContext.Provider value={client}>
      {children}
    </QueryClientContext.Provider>
  );
};

// useQueryClient hook
export const useQueryClient = () => {
  const client = React.useContext(QueryClientContext);
  if (!client) {
    // Return a default client if none is provided (for testing)
    return new QueryClient();
  }
  return client;
};

// Mock query result
const createQueryResult = (overrides: any = {}) => ({
  data: undefined,
  error: null,
  isError: false,
  isSuccess: false,
  isLoading: true,
  isLoadingError: false,
  isRefetchError: false,
  isRefetching: false,
  status: 'loading',
  fetchStatus: 'idle',
  isPending: true,
  isFetched: false,
  isFetchedAfterMount: false,
  isPlaceholderData: false,
  isPaused: false,
  isStale: false,
  refetch: jest.fn().mockResolvedValue({ data: undefined, error: null }),
  remove: jest.fn(),
  failureCount: 0,
  failureReason: null,
  errorUpdateCount: 0,
  dataUpdatedAt: 0,
  errorUpdatedAt: 0,
  promise: Promise.resolve(),
  ...overrides,
});

// useQuery hook
export const useQuery = jest.fn((options: any) => {
  const { queryKey, queryFn, enabled = true, ...restOptions } = options;
  
  // Simple mock behavior
  if (!enabled) {
    return createQueryResult({ isLoading: false, status: 'idle' });
  }
  
  // Mock successful query
  return createQueryResult({
    data: restOptions.initialData,
    isSuccess: !!restOptions.initialData,
    isLoading: !restOptions.initialData,
    status: restOptions.initialData ? 'success' : 'loading',
  });
});

// useMutation hook
export const useMutation = jest.fn((options: any = {}) => {
  const { mutationFn, onSuccess, onError, onSettled, ...restOptions } = options;
  
  const mutate = jest.fn((variables: any, mutateOptions?: any) => {
    // Call callbacks if provided
    const mergedOptions = { ...mutateOptions };
    
    Promise.resolve().then(() => {
      if (mergedOptions.onSuccess || onSuccess) {
        (mergedOptions.onSuccess || onSuccess)?.(variables, variables, undefined);
      }
      if (mergedOptions.onSettled || onSettled) {
        (mergedOptions.onSettled || onSettled)?.(variables, null, variables, undefined);
      }
    });
  });
  
  const mutateAsync = jest.fn((variables: any, mutateOptions?: any) => {
    mutate(variables, mutateOptions);
    return Promise.resolve(variables);
  });
  
  return {
    mutate,
    mutateAsync,
    data: undefined,
    error: null,
    isError: false,
    isSuccess: false,
    isLoading: false,
    isPending: false,
    isIdle: true,
    status: 'idle',
    variables: undefined,
    context: undefined,
    failureCount: 0,
    failureReason: null,
    isPaused: false,
    reset: jest.fn(),
    submittedAt: 0,
    ...restOptions,
  };
});

// useQueries hook
export const useQueries = jest.fn((options: any) => {
  return options.queries.map((queryOptions: any) => 
    createQueryResult({
      data: queryOptions.initialData,
      isSuccess: !!queryOptions.initialData,
      isLoading: !queryOptions.initialData,
      status: queryOptions.initialData ? 'success' : 'loading',
    })
  );
});

// useInfiniteQuery hook
export const useInfiniteQuery = jest.fn((options: any) => {
  const { queryKey, queryFn, getNextPageParam, enabled = true, ...restOptions } = options;
  
  if (!enabled) {
    return {
      ...createQueryResult({ isLoading: false, status: 'idle' }),
      data: undefined,
      hasNextPage: false,
      hasPreviousPage: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      fetchNextPage: jest.fn().mockResolvedValue({ data: undefined }),
      fetchPreviousPage: jest.fn().mockResolvedValue({ data: undefined }),
    };
  }
  
  return {
    ...createQueryResult({
      data: restOptions.initialData || { pages: [], pageParams: [] },
      isSuccess: !!restOptions.initialData,
      isLoading: !restOptions.initialData,
      status: restOptions.initialData ? 'success' : 'loading',
    }),
    hasNextPage: false,
    hasPreviousPage: false,
    isFetchingNextPage: false,
    isFetchingPreviousPage: false,
    fetchNextPage: jest.fn().mockResolvedValue({ data: { pages: [], pageParams: [] } }),
    fetchPreviousPage: jest.fn().mockResolvedValue({ data: { pages: [], pageParams: [] } }),
  };
});

// useIsFetching hook
export const useIsFetching = jest.fn(() => 0);

// useIsMutating hook
export const useIsMutating = jest.fn(() => 0);

// Hydration components
export const Hydrate: React.FC<{ state: any; children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const HydrationBoundary: React.FC<{ state: any; children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// dehydrate function
export const dehydrate = jest.fn((client: QueryClient) => ({
  mutations: [],
  queries: [],
}));

// hydrate function
export const hydrate = jest.fn((client: QueryClient, dehydratedState: any) => {});

// Query utilities
export const hashQueryKey = jest.fn((queryKey: any) => JSON.stringify(queryKey));

export const isError = jest.fn((value: any) => value instanceof Error);

// Query observer
export class QueryObserver {
  constructor(client: QueryClient, options: any) {
    this.client = client;
    this.options = options;
  }
  
  client: QueryClient;
  options: any;
  
  subscribe = jest.fn().mockReturnValue(() => {});
  getOptimisticResult = jest.fn().mockReturnValue(createQueryResult());
  getCurrentResult = jest.fn().mockReturnValue(createQueryResult());
  trackResult = jest.fn((result: any) => result);
  refetch = jest.fn().mockResolvedValue({ data: undefined, error: null });
}

// Export everything
export default {
  QueryClient,
  QueryCache,
  MutationCache,
  QueryClientProvider,
  useQueryClient,
  useQuery,
  useMutation,
  useQueries,
  useInfiniteQuery,
  useIsFetching,
  useIsMutating,
  Hydrate,
  HydrationBoundary,
  dehydrate,
  hydrate,
  hashQueryKey,
  isError,
  QueryObserver,
};