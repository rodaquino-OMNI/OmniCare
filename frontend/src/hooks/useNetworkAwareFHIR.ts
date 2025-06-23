import { useCallback } from 'react';
import { useMutation, useQuery, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { FhirResource, Bundle, OperationOutcome } from 'fhir/r4';
import { useNetworkStatusContext } from '@/contexts/NetworkStatusContext';
import { useNetworkAware, NetworkAwareOptions } from '@/hooks/useNetworkAware';
import { backgroundSyncService, addSyncTask } from '@/services/background-sync.service';
import { createRetryQueueItem } from '@/services/network-retry.service';
import { fhirService } from '@/services/fhir.service';
import { queryClient } from '@/lib/providers';

interface NetworkAwareFHIROptions extends NetworkAwareOptions {
  enableOfflineQueue?: boolean;
  syncStrategy?: 'immediate' | 'background' | 'manual';
  conflictResolution?: 'client-wins' | 'server-wins' | 'merge' | 'manual';
}

interface FHIRSearchParams {
  [key: string]: string | string[] | number | boolean | undefined;
}

export function useNetworkAwareFHIRResource<T extends FhirResource>(
  resourceType: string,
  id: string,
  options: NetworkAwareFHIROptions = {},
  queryOptions?: UseQueryOptions<T | null>
) {
  const networkStatus = useNetworkStatusContext();
  
  return useNetworkAware<T | null>(
    async () => {
      if (!id) return null;
      return fhirService.read(resourceType, id) as Promise<T>;
    },
    [resourceType, id],
    {
      enableAutoRetry: true,
      cacheStrategy: 'cache-first',
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      ...options,
    }
  );
}

export function useNetworkAwareFHIRSearch<T extends FhirResource>(
  resourceType: string,
  params: FHIRSearchParams,
  options: NetworkAwareFHIROptions = {},
  queryOptions?: UseQueryOptions<Bundle<T>>
) {
  const networkStatus = useNetworkStatusContext();
  
  return useNetworkAware<Bundle<T>>(
    async () => {
      return fhirService.search(resourceType, params) as Promise<Bundle<T>>;
    },
    [resourceType, JSON.stringify(params)],
    {
      enableAutoRetry: true,
      cacheStrategy: networkStatus.saveData ? 'cache-first' : 'network-first',
      cacheDuration: networkStatus.saveData ? 15 * 6 * 1000 : 5 * 6 * 1000,
      ...options,
    }
  );
}

export function useNetworkAwareFHIRMutation<T extends FhirResource>(
  resourceType: string,
  options: NetworkAwareFHIROptions = {},
  mutationOptions?: UseMutationOptions<T, Error, Partial<T>>
) {
  const networkStatus = useNetworkStatusContext();
  const { enableOfflineQueue = true, syncStrategy = 'immediate', conflictResolution = 'merge' } = options;

  return useMutation<T, Error, Partial<T>>({
    mutationFn: async (data: Partial<T>) => {
      if (!networkStatus.isConnected && enableOfflineQueue) {
        // Add to offline queue
        const taskId = addSyncTask({
          type: data.id ? 'update' : 'create',
          resource: resourceType,
          data: {
            ...data,
            resourceType,
          },
          priority: 'normal',
          conflictResolution,
          maxRetries: 3,
        });

        // Return optimistic response
        return {
          ...data,
          resourceType,
          id: data.id || `offline-${Date.now()}`,
          meta: {
            ...data.meta,
            tag: [
              ...(data.meta?.tag || []),
              { system: 'http://omnicare/offline', code: 'offline-pending' },
            ],
          },
        } as T;
      }

      // Online - perform normal mutation
      if (data.id) {
        return fhirService.update(resourceType, data.id, data) as Promise<T>;
      } else {
        return fhirService.create(resourceType, data) as Promise<T>;
      }
    },
    onSuccess: (result, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['fhir', resourceType] });
      
      if (result.id) {
        queryClient.invalidateQueries({ queryKey: ['fhir', resourceType, result.id] });
      }
    },
    onError: (error, variables) => {
      if (networkStatus.isConnected || !enableOfflineQueue) {
        return;
      }

      // Add to retry queue for network errors
      const retryItem = createRetryQueueItem(
        {
          url: `/api/fhir/${resourceType}${variables.id ? `/${variables.id}` : ''}`,
          options: {
            method: variables.id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/fhir+json' },
            body: JSON.stringify({ ...variables, resourceType }),
          },
        },
        (result) => {
          queryClient.invalidateQueries({ queryKey: ['fhir', resourceType] });
        }
      );

      networkStatus.addToRetryQueue(retryItem);
    },
    ...mutationOptions,
  });
}

export function useNetworkAwareFHIRDelete(
  resourceType: string,
  options: NetworkAwareFHIROptions = {},
  mutationOptions?: UseMutationOptions<void, Error, string>
) {
  const networkStatus = useNetworkStatusContext();
  const { enableOfflineQueue = true } = options;

  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      if (!networkStatus.isConnected && enableOfflineQueue) {
        // Add to offline queue
        addSyncTask({
          type: 'delete',
          resource: 'fhir',
          data: {
            resourceType,
            id,
          },
          priority: 'normal',
        });

        // Optimistically remove from cache
        queryClient.removeQueries({ queryKey: ['fhir', resourceType, id] });
        return;
      }

      // Online - perform normal deletion
      return fhirService.delete(resourceType, id);
    },
    onSuccess: (_, id) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['fhir', resourceType] });
      queryClient.removeQueries({ queryKey: ['fhir', resourceType, id] });
    },
    onError: (error, id) => {
      if (networkStatus.isConnected || !enableOfflineQueue) {
        return;
      }

      // Add to retry queue for network errors
      const retryItem = createRetryQueueItem(
        {
          url: `/api/fhir/${resourceType}/${id}`,
          options: {
            method: 'DELETE',
          },
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fhir', resourceType] });
          queryClient.removeQueries({ queryKey: ['fhir', resourceType, id] });
        }
      );

      networkStatus.addToRetryQueue(retryItem);
    },
    ...mutationOptions,
  });
}

// Batch operations for network efficiency
export function useNetworkAwareFHIRBatch(
  options: NetworkAwareFHIROptions = {},
  mutationOptions?: UseMutationOptions<Bundle, Error, Bundle>
) {
  const networkStatus = useNetworkStatusContext();
  const { enableOfflineQueue = true } = options;

  return useMutation<Bundle, Error, Bundle>({
    mutationFn: async (bundle: Bundle) => {
      if (!networkStatus.isConnected && enableOfflineQueue) {
        // Split bundle into individual tasks for offline queue
        bundle.entry?.forEach((entry) => {
          if (entry.request && entry.resource) {
            addSyncTask({
              type: entry.request.method?.toLowerCase() as any,
              resource: 'fhir',
              data: entry.resource,
              priority: 'normal',
              metadata: {
                bundleId: bundle.id,
                fullUrl: entry.fullUrl,
              },
            });
          }
        });

        // Return optimistic response
        return {
          ...bundle,
          type: 'batch-response',
          entry: bundle.entry?.map((entry) => ({
            ...entry,
            response: {
              status: '202 Accepted',
              location: entry.fullUrl,
            },
          })),
        } as Bundle;
      }

      // Online - perform normal batch operation
      return fhirService.batch(bundle);
    },
    onSuccess: (result) => {
      // Invalidate all potentially affected queries
      result.entry?.forEach((entry) => {
        if (entry.resource && entry.response?.status?.startsWith('2')) {
          const resourceType = entry.resource.resourceType;
          queryClient.invalidateQueries({ queryKey: ['fhir', resourceType] });
        }
      });
    },
    ...mutationOptions,
  });
}

// Initialize background sync for FHIR resources
export function initializeFHIRBackgroundSync() {
  backgroundSyncService.initialize(() => navigator.onLine);
  
  // Register FHIR-specific conflict resolver
  backgroundSyncService.registerConflictResolver('fhir', async (task, serverData) => {
    const clientData = task.data;
    
    switch (task.conflictResolution) {
      case 'client-wins':
        return clientData;
        
      case 'server-wins':
        return serverData;
        
      case 'merge':
        // Merge non-conflicting fields, preferring client changes
        return {
          ...serverData,
          ...clientData,
          meta: {
            ...serverData.meta,
            ...clientData.meta,
            lastUpdated: new Date().toISOString(),
            tag: [
              ...(serverData.meta?.tag || []),
              ...(clientData.meta?.tag || []),
              { system: 'http://omnicare/sync', code: 'merged' },
            ],
          },
        };
        
      default:
        throw new Error('Manual conflict resolution required');
    }
  });
}