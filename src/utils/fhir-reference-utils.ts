/**
 * FHIR Reference Type Utilities
 * 
 * This module provides utilities for handling FHIR Reference types with flexible
 * type constraints while maintaining FHIR standard compliance.
 * 
 * The @medplum/fhirtypes package uses strongly typed Reference<T> types that can be
 * overly restrictive. These utilities provide type-safe ways to work with references
 * in a more flexible manner.
 */

import { Reference, Resource } from '@medplum/fhirtypes';

/**
 * Type alias for any FHIR Reference
 * This allows assignment from any Reference<T> to a general reference type
 */
export type AnyReference = Reference<Resource>;

/**
 * Type guard to check if value is a FHIR Reference
 */
export function isReference(value: unknown): value is Reference {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('reference' in value || 'display' in value || 'type' in value)
  );
}

/**
 * Create a Reference object from a resource type and ID
 */
export function createReference<T extends Resource>(
  resourceType: string,
  id: string,
  display?: string
): Reference<T> {
  const ref: Reference<T> = {
    reference: `${resourceType}/${id}`
  };
  
  if (display) {
    ref.display = display;
  }
  
  return ref;
}

/**
 * Create a Reference from a resource instance
 */
export function createReferenceFromResource<T extends Resource>(
  resource: T,
  display?: string
): Reference<T> {
  if (!resource.id) {
    throw new Error('Resource must have an ID to create a reference');
  }
  
  return createReference<T>(resource.resourceType, resource.id, display);
}

/**
 * Parse a reference string into its components
 */
export function parseReference(reference: string): {
  resourceType: string;
  id: string;
  isAbsolute: boolean;
  baseUrl?: string;
} {
  // Handle absolute URLs
  if (reference.startsWith('http://') || reference.startsWith('https://')) {
    const url = new URL(reference);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    if (pathParts.length >= 2) {
      const resourceType = pathParts[pathParts.length - 2];
      const id = pathParts[pathParts.length - 1];
      
      return {
        resourceType,
        id,
        isAbsolute: true,
        baseUrl: url.origin
      };
    }
  }
  
  // Handle relative references
  const parts = reference.split('/');
  if (parts.length === 2) {
    return {
      resourceType: parts[0],
      id: parts[1],
      isAbsolute: false
    };
  }
  
  throw new Error(`Invalid reference format: ${reference}`);
}

/**
 * Extract resource type from a Reference
 */
export function getReferenceResourceType(ref: Reference): string | undefined {
  if (ref.type) {
    return ref.type;
  }
  
  if (ref.reference) {
    try {
      const parsed = parseReference(ref.reference);
      return parsed.resourceType;
    } catch {
      return undefined;
    }
  }
  
  return undefined;
}

/**
 * Extract resource ID from a Reference
 */
export function getReferenceId(ref: Reference): string | undefined {
  if (ref.reference) {
    try {
      const parsed = parseReference(ref.reference);
      return parsed.id;
    } catch {
      return undefined;
    }
  }
  
  return undefined;
}

/**
 * Check if a reference points to a specific resource type
 */
export function isReferenceToType(ref: Reference, resourceType: string): boolean {
  const refType = getReferenceResourceType(ref);
  return refType === resourceType;
}

/**
 * Cast a Reference to a specific type (use with caution)
 * This is a type assertion that should only be used when you're certain of the type
 */
export function castReference<T extends Resource>(ref: Reference): Reference<T> {
  return ref as Reference<T>;
}

/**
 * Safe cast with type checking
 * Returns the reference if it matches the expected type, otherwise returns undefined
 */
export function safeCastReference<T extends Resource>(
  ref: Reference,
  expectedType: string
): Reference<T> | undefined {
  if (isReferenceToType(ref, expectedType)) {
    return ref as Reference<T>;
  }
  return undefined;
}

/**
 * Create a reference that can be assigned to any Reference<T> type
 * This uses type widening to create a flexible reference
 */
export function createFlexibleReference(
  resourceType: string,
  id: string,
  display?: string
): Reference<Resource> {
  return createReference<Resource>(resourceType, id, display);
}

/**
 * Convert any reference to a flexible reference type
 * This allows assignment to any specific Reference<T> type
 */
export function toFlexibleReference(ref: Reference): Reference<Resource> {
  return ref as Reference<Resource>;
}

/**
 * Type predicate to check if reference can be assigned to a specific type
 */
export function canAssignReference<T extends Resource>(
  ref: Reference,
  targetType: string
): ref is Reference<T> {
  const refType = getReferenceResourceType(ref);
  return refType === targetType || refType === undefined;
}

/**
 * Create a reference array that can accept multiple resource types
 */
export function createReferenceArray(...refs: Reference[]): Reference<Resource>[] {
  return refs.map(toFlexibleReference);
}

/**
 * Helper to handle optional references
 */
export function optionalReference<T extends Resource>(
  condition: boolean,
  resourceType: string,
  id: string,
  display?: string
): Reference<T> | undefined {
  return condition ? createReference<T>(resourceType, id, display) : undefined;
}

/**
 * Batch create references from an array of IDs
 */
export function createReferences<T extends Resource>(
  resourceType: string,
  ids: string[],
  displayMap?: Record<string, string>
): Reference<T>[] {
  return ids.map(id => 
    createReference<T>(resourceType, id, displayMap?.[id])
  );
}

/**
 * Filter references by resource type
 */
export function filterReferencesByType<T extends Resource>(
  refs: Reference[],
  resourceType: string
): Reference<T>[] {
  return refs
    .filter(ref => isReferenceToType(ref, resourceType))
    .map(ref => ref as Reference<T>);
}

/**
 * Group references by resource type
 */
export function groupReferencesByType(
  refs: Reference[]
): Record<string, Reference[]> {
  const groups: Record<string, Reference[]> = {};
  
  refs.forEach(ref => {
    const type = getReferenceResourceType(ref);
    if (type) {
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(ref);
    }
  });
  
  return groups;
}

/**
 * Resolve a reference to its full URL if relative
 */
export function resolveReference(ref: Reference, baseUrl: string): Reference {
  if (!ref.reference || ref.reference.startsWith('http')) {
    return ref;
  }
  
  return {
    ...ref,
    reference: `${baseUrl.replace(/\/$/, '')}/${ref.reference}`
  };
}

/**
 * Make a reference relative if it's absolute
 */
export function makeReferenceRelative(ref: Reference): Reference {
  if (!ref.reference || !ref.reference.startsWith('http')) {
    return ref;
  }
  
  try {
    const parsed = parseReference(ref.reference);
    return {
      ...ref,
      reference: `${parsed.resourceType}/${parsed.id}`
    };
  } catch {
    return ref;
  }
}

/**
 * Compare two references for equality
 */
export function areReferencesEqual(ref1: Reference, ref2: Reference): boolean {
  // If both have reference strings, compare them
  if (ref1.reference && ref2.reference) {
    // Make both relative for comparison
    const relative1 = makeReferenceRelative(ref1);
    const relative2 = makeReferenceRelative(ref2);
    return relative1.reference === relative2.reference;
  }
  
  // If neither has reference, check if they're the same object
  return ref1 === ref2;
}

/**
 * Utility type for references that can point to multiple resource types
 */
export type MultiReference<T extends Resource = Resource> = Reference<T>;

/**
 * Create a type-safe reference handler for specific resource types
 */
export class ReferenceHandler<T extends Resource> {
  constructor(private resourceType: string) {}
  
  create(id: string, display?: string): Reference<T> {
    return createReference<T>(this.resourceType, id, display);
  }
  
  createFromResource(resource: T, display?: string): Reference<T> {
    return createReferenceFromResource(resource, display);
  }
  
  isValidReference(ref: Reference): ref is Reference<T> {
    return isReferenceToType(ref, this.resourceType);
  }
  
  cast(ref: Reference): Reference<T> {
    if (!this.isValidReference(ref)) {
      throw new Error(`Reference does not point to ${this.resourceType}`);
    }
    return ref;
  }
  
  safeCast(ref: Reference): Reference<T> | undefined {
    return this.isValidReference(ref) ? ref : undefined;
  }
}

// Export commonly used reference handlers
export const PatientReferenceHandler = new ReferenceHandler('Patient');
export const PractitionerReferenceHandler = new ReferenceHandler('Practitioner');
export const OrganizationReferenceHandler = new ReferenceHandler('Organization');
export const EncounterReferenceHandler = new ReferenceHandler('Encounter');
export const ObservationReferenceHandler = new ReferenceHandler('Observation');

/**
 * Type alias for common reference patterns
 */
export type PatientReference = Reference<import('@medplum/fhirtypes').Patient>;
export type PractitionerReference = Reference<import('@medplum/fhirtypes').Practitioner>;
export type OrganizationReference = Reference<import('@medplum/fhirtypes').Organization>;
export type EncounterReference = Reference<import('@medplum/fhirtypes').Encounter>;
export type ObservationReference = Reference<import('@medplum/fhirtypes').Observation>;