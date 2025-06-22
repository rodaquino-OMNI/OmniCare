/**
 * Type-Safe FHIR Search Utilities
 * 
 * Provides type-safe wrappers around searchResources with proper generic constraints
 */

import { MedplumClient } from '@medplum/core';
import { Bundle, Resource } from '@medplum/fhirtypes';
import {
  ResourceTypeMap,
  SearchableResource,
  FHIRSearchParams,
  SearchResult,
  SearchBundle,
  createSearchParams,
  transformSearchResult,
  PatientSearchParams,
  EncounterSearchParams,
  ObservationSearchParams,
  ServiceRequestSearchParams,
  TaskSearchParams
} from '../types/fhir-search.types';

/**
 * Type-safe search wrapper for MedplumClient
 */
export class TypeSafeFHIRSearch {
  constructor(private medplum: MedplumClient) {}

  /**
   * Type-safe search resources method with proper generic constraints
   */
  async searchResources<T extends keyof ResourceTypeMap>(
    resourceType: T,
    searchParams: FHIRSearchParams = {}
  ): Promise<SearchBundle<ResourceTypeMap[T]>> {
    // Convert parameters to the format expected by medplum
    const convertedParams: Record<string, any> = {};
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        convertedParams[key] = value;
      }
    });

    const result = await this.medplum.searchResources(resourceType as any, convertedParams);
    
    // Handle different return types from medplum.searchResources
    if (Array.isArray(result)) {
      // If it returns an array directly, wrap in Bundle
      const bundle: Bundle<ResourceTypeMap[T]> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: result.length,
        entry: result.map((resource: any) => ({
          resource: resource as ResourceTypeMap[T],
          fullUrl: `${resource.resourceType}/${resource.id}`
        }))
      };
      return bundle;
    } else if (result && typeof result === 'object' && 'resourceType' in result && (result as any).resourceType === 'Bundle') {
      // If it's already a Bundle, return it
      return result as SearchBundle<ResourceTypeMap[T]>;
    } else {
      // Handle other formats (like ResourceArray from Medplum)
      const resources = (result as any)?.bundle?.entry?.map((entry: any) => entry.resource) || [];
      const bundle: Bundle<ResourceTypeMap[T]> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: resources.length,
        entry: resources.map((resource: any) => ({
          resource: resource as ResourceTypeMap[T],
          fullUrl: `${resource.resourceType}/${resource.id}`
        }))
      };
      return bundle;
    }
  }

  /**
   * Search and transform results to a more convenient format
   */
  async searchAndTransform<T extends keyof ResourceTypeMap>(
    resourceType: T,
    searchParams: FHIRSearchParams = {}
  ): Promise<SearchResult<ResourceTypeMap[T]>> {
    const bundle = await this.searchResources(resourceType, searchParams);
    return transformSearchResult(bundle);
  }

  /**
   * Get only the resources array from search results
   */
  async getResources<T extends keyof ResourceTypeMap>(
    resourceType: T,
    searchParams: FHIRSearchParams = {}
  ): Promise<ResourceTypeMap[T][]> {
    const result = await this.searchAndTransform(resourceType, searchParams);
    return result.resources;
  }

  /**
   * Search for a single resource (returns first match)
   */
  async searchOne<T extends keyof ResourceTypeMap>(
    resourceType: T,
    searchParams: FHIRSearchParams = {}
  ): Promise<ResourceTypeMap[T] | null> {
    const params = { ...searchParams, _count: 1 };
    const resources = await this.getResources(resourceType, params);
    return resources[0] || null;
  }

  /**
   * Count resources matching search criteria
   */
  async countResources<T extends keyof ResourceTypeMap>(
    resourceType: T,
    searchParams: FHIRSearchParams = {}
  ): Promise<number> {
    const params = { ...searchParams, _summary: 'count' as const, _count: 0 };
    const bundle = await this.searchResources(resourceType, params);
    return bundle.total || 0;
  }

  /**
   * Check if any resources exist matching criteria
   */
  async exists<T extends keyof ResourceTypeMap>(
    resourceType: T,
    searchParams: FHIRSearchParams = {}
  ): Promise<boolean> {
    const count = await this.countResources(resourceType, searchParams);
    return count > 0;
  }

  // ===============================
  // SPECIALIZED SEARCH METHODS
  // ===============================

  /**
   * Search patients with type-safe parameters
   */
  async searchPatients(params: PatientSearchParams = {}): Promise<SearchResult<ResourceTypeMap['Patient']>> {
    return this.searchAndTransform('Patient', params);
  }

  /**
   * Search encounters with type-safe parameters
   */
  async searchEncounters(params: EncounterSearchParams = {}): Promise<SearchResult<ResourceTypeMap['Encounter']>> {
    return this.searchAndTransform('Encounter', params);
  }

  /**
   * Search observations with type-safe parameters
   */
  async searchObservations(params: ObservationSearchParams = {}): Promise<SearchResult<ResourceTypeMap['Observation']>> {
    return this.searchAndTransform('Observation', params);
  }

  /**
   * Search service requests with type-safe parameters
   */
  async searchServiceRequests(params: ServiceRequestSearchParams = {}): Promise<SearchResult<ResourceTypeMap['ServiceRequest']>> {
    return this.searchAndTransform('ServiceRequest', params);
  }

  /**
   * Search tasks with type-safe parameters
   */
  async searchTasks(params: TaskSearchParams = {}): Promise<SearchResult<ResourceTypeMap['Task']>> {
    return this.searchAndTransform('Task', params);
  }

  // ===============================
  // BATCH SEARCH OPERATIONS
  // ===============================

  /**
   * Search multiple resource types in parallel
   */
  async searchMultiple<T extends keyof ResourceTypeMap>(
    searches: Array<{ resourceType: T; params: FHIRSearchParams }>
  ): Promise<Array<SearchResult<ResourceTypeMap[T]>>> {
    const searchPromises = searches.map(({ resourceType, params }) =>
      this.searchAndTransform(resourceType, params)
    );
    return Promise.all(searchPromises);
  }

  /**
   * Search with pagination support
   */
  async searchWithPagination<T extends keyof ResourceTypeMap>(
    resourceType: T,
    searchParams: FHIRSearchParams = {},
    pageSize: number = 20
  ): Promise<{
    results: SearchResult<ResourceTypeMap[T]>;
    nextPage?: () => Promise<SearchResult<ResourceTypeMap[T]>>;
    previousPage?: () => Promise<SearchResult<ResourceTypeMap[T]>>;
  }> {
    const params = { ...searchParams, _count: pageSize };
    const results = await this.searchAndTransform(resourceType, params);
    
    let nextPage: (() => Promise<SearchResult<ResourceTypeMap[T]>>) | undefined;
    let previousPage: (() => Promise<SearchResult<ResourceTypeMap[T]>>) | undefined;

    if (results.hasNext) {
      nextPage = () => this.searchAndTransform(resourceType, {
        ...params,
        _offset: (params._offset || 0) + pageSize
      });
    }

    if (results.hasPrevious && (params._offset || 0) > 0) {
      previousPage = () => this.searchAndTransform(resourceType, {
        ...params,
        _offset: Math.max(0, (params._offset || 0) - pageSize)
      });
    }

    return { results, nextPage, previousPage };
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Convert legacy searchResources calls to type-safe calls
   */
  async legacySearchResources<T extends Resource>(
    resourceType: string,
    searchParams: FHIRSearchParams = {}
  ): Promise<Bundle<T>> {
    // Type assertion for legacy compatibility
    const typedResourceType = resourceType as keyof ResourceTypeMap;
    return this.searchResources(typedResourceType, searchParams) as Promise<Bundle<T>>;
  }

  /**
   * Get reference string for a resource
   */
  getResourceReference<T extends keyof ResourceTypeMap>(
    resourceType: T,
    id: string
  ): string {
    return `${resourceType}/${id}`;
  }

  /**
   * Parse reference string to get resource type and ID
   */
  parseReference(reference: string): { resourceType: string; id: string } | null {
    const match = reference.match(/^([A-Za-z]+)\/(.+)$/);
    if (!match) return null;
    
    return {
      resourceType: match[1],
      id: match[2]
    };
  }
}

/**
 * Create a type-safe FHIR search instance
 */
export function createTypeSafeFHIRSearch(medplum: MedplumClient): TypeSafeFHIRSearch {
  return new TypeSafeFHIRSearch(medplum);
}

/**
 * Static utility functions for type-safe searches
 */
export const FHIRSearchUtils = {
  /**
   * Create search parameters with proper typing
   */
  createParams: createSearchParams,

  /**
   * Transform bundle results
   */
  transformResult: transformSearchResult,

  /**
   * Type-safe resource checker
   */
  isResourceType<T extends keyof ResourceTypeMap>(
    resource: Resource,
    resourceType: T
  ): resource is ResourceTypeMap[T] {
    return resource.resourceType === resourceType;
  },

  /**
   * Extract first resource from bundle
   */
  getFirstResource<T extends Resource>(bundle: Bundle<T>): T | null {
    return bundle.entry?.[0]?.resource || null;
  },

  /**
   * Get all resources from bundle
   */
  getAllResources<T extends Resource>(bundle: Bundle<T>): T[] {
    return bundle.entry?.map(entry => entry.resource).filter((resource): resource is T => 
      resource !== undefined
    ) || [];
  }
};

/**
 * Export convenience functions
 */
export { createSearchParams, transformSearchResult };