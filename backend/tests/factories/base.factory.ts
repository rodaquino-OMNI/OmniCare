/**
 * Base Factory - Common utilities for all factories
 */

import { faker } from '@faker-js/faker';

import { 
  FHIRResource,
  Identifier, 
  HumanName, 
  Address, 
  ContactPoint, 
  Reference, 
  CodeableConcept,
  Period,
  Quantity,
  Money,
  Annotation,
  Attachment
} from '../../src/models/base.model';

import { formatValidDate, randomDateBetween } from './utils/date-utils';

let idCounter = 1;

/**
 * Base Factory Class
 */
export class BaseFactory {
  /**
   * Generate a unique ID
   */
  static generateId(prefix = 'id'): string {
    return `${prefix}-${(idCounter++).toString().padStart(8, '0')}`;
  }

  /**
   * Create base FHIR resource fields
   */
  static createBaseFHIRResource(resourceType: string): Partial<FHIRResource> {
    return {
      resourceType,
      id: this.generateId(resourceType.toLowerCase()),
      meta: {
        versionId: '1',
        lastUpdated: formatValidDate(new Date()),
        profile: [`http://hl7.org/fhir/us/core/StructureDefinition/us-core-${resourceType.toLowerCase()}`]
      },
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };
  }

  /**
   * Create a valid Identifier
   */
  static createIdentifier(overrides: Partial<Identifier> = {}): Identifier {
    const defaultSystem = 'http://omnicare.com/patient-id';
    return {
      use: 'usual',
      system: defaultSystem,
      value: faker.string.alphanumeric(8).toUpperCase(),
      period: {
        start: formatValidDate(randomDateBetween(new Date(2020, 0, 1), new Date()))
      },
      ...overrides
    };
  }

  /**
   * Create a valid HumanName
   */
  static createHumanName(overrides: Partial<HumanName> = {}): HumanName {
    return {
      use: 'official',
      family: faker.person.lastName(),
      given: [faker.person.firstName()],
      prefix: [],
      suffix: [],
      ...overrides
    };
  }

  /**
   * Create a valid Address
   */
  static createAddress(overrides: Partial<Address> = {}): Address {
    return {
      use: 'home',
      type: 'physical',
      line: [faker.location.streetAddress()],
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      postalCode: faker.location.zipCode(),
      country: 'US',
      period: {
        start: formatValidDate(randomDateBetween(new Date(2020, 0, 1), new Date()))
      },
      ...overrides
    };
  }

  /**
   * Create a valid ContactPoint
   */
  static createContactPoint(overrides: Partial<ContactPoint> = {}): ContactPoint {
    const system = overrides.system || faker.helpers.arrayElement(['phone', 'email', 'fax']);
    const value = system === 'email' 
      ? faker.internet.email()
      : system === 'phone' 
        ? faker.phone.number()
        : faker.phone.number();

    return {
      system,
      value,
      use: faker.helpers.arrayElement(['home', 'work', 'mobile']),
      rank: 1,
      ...overrides
    };
  }

  /**
   * Create a valid Reference
   */
  static createReference(resourceType: string, id?: string, display?: string): Reference {
    const resourceId = id || this.generateId(resourceType.toLowerCase());
    return {
      reference: `${resourceType}/${resourceId}`,
      type: resourceType,
      display: display || `${resourceType} ${resourceId}`
    };
  }

  /**
   * Create a valid CodeableConcept
   */
  static createCodeableConcept(code: string, display: string, system?: string): CodeableConcept {
    return {
      coding: [{
        system: system || 'http://terminology.hl7.org/CodeSystem/data-absent-reason',
        code,
        display,
        userSelected: false
      }],
      text: display
    };
  }

  /**
   * Create a valid Period
   */
  static createPeriod(overrides: Partial<Period> = {}): Period {
    const start = randomDateBetween(new Date(2020, 0, 1), new Date());
    const end = randomDateBetween(start, new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000));
    
    return {
      start: formatValidDate(start),
      end: formatValidDate(end),
      ...overrides
    };
  }

  /**
   * Create a valid Quantity
   */
  static createQuantity(value: number, unit: string, code?: string): Quantity {
    return {
      value,
      unit,
      system: 'http://unitsofmeasure.org',
      code: code || unit,
      comparator: undefined
    };
  }

  /**
   * Create a valid Money object
   */
  static createMoney(value: number, currency = 'USD'): Money {
    return {
      value,
      currency
    };
  }

  /**
   * Create a valid Annotation
   */
  static createAnnotation(text: string, authorString?: string): Annotation {
    return {
      authorString: authorString || faker.person.fullName(),
      time: formatValidDate(new Date()),
      text
    };
  }

  /**
   * Create a valid Attachment
   */
  static createAttachment(overrides: Partial<Attachment> = {}): Attachment {
    return {
      contentType: 'text/plain',
      language: 'en-US',
      title: faker.lorem.words(3),
      creation: formatValidDate(new Date()),
      size: faker.number.int({ min: 100, max: 10000 }),
      ...overrides
    };
  }

  /**
   * Create multiple instances of a factory function
   */
  static createMany<T>(
    factoryFunction: () => T,
    count: number = faker.number.int({ min: 1, max: 5 })
  ): T[] {
    return Array.from({ length: count }, () => factoryFunction());
  }

  /**
   * Create a random subset from an array
   */
  static randomSubset<T>(array: T[], maxCount?: number): T[] {
    const count = maxCount || faker.number.int({ min: 1, max: Math.min(array.length, 3) });
    return faker.helpers.arrayElements(array, count);
  }

  /**
   * Maybe create (50% chance) - useful for optional fields
   */
  static maybe<T>(factoryFunction: () => T, probability = 0.5): T | undefined {
    return Math.random() < probability ? factoryFunction() : undefined;
  }

  /**
   * Reset ID counter (useful for tests)
   */
  static resetIdCounter(): void {
    idCounter = 1;
  }
}

/**
 * Common validation status enums
 */
export const ValidationStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked'
} as const;

/**
 * Common gender values
 */
export const Gender = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
  UNKNOWN: 'unknown'
} as const;

/**
 * Common use types
 */
export const UseType = {
  USUAL: 'usual',
  OFFICIAL: 'official',
  TEMP: 'temp',
  SECONDARY: 'secondary',
  OLD: 'old'
} as const;