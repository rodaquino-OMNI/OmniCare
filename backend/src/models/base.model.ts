/**
 * Base Model Interface
 * Common fields and methods shared across all OmniCare entities
 */

export interface BaseModel {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version?: number;
  active?: boolean;
}

export interface FHIRResource extends BaseModel {
  resourceType: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    source?: string;
    profile?: string[];
    security?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    tag?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  implicitRules?: string;
  language?: string;
  text?: {
    status: 'generated' | 'extensions' | 'additional' | 'empty';
    div: string;
  };
  contained?: FHIRResource[];
  extension?: Array<{
    url: string;
    valueString?: string;
    valueCode?: string;
    valueDateTime?: string;
    valueBoolean?: boolean;
    valueInteger?: number;
    valueDecimal?: number;
    [key: string]: unknown;
  }>;
  modifierExtension?: Array<{
    url: string;
    [key: string]: unknown;
  }>;
}

export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  system?: string;
  value?: string;
  period?: {
    start?: string;
    end?: string;
  };
  assigner?: {
    reference?: string;
    display?: string;
  };
}

export interface HumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: {
    start?: string;
    end?: string;
  };
}

export interface Address {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: {
    start?: string;
    end?: string;
  };
}

export interface ContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: {
    start?: string;
    end?: string;
  };
}

export interface Reference {
  reference?: string;
  type?: string;
  identifier?: Identifier;
  display?: string;
}

export interface Coding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface Period {
  start?: string;
  end?: string;
}

export interface Quantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface Money {
  value?: number;
  currency?: string;
}

export interface Annotation {
  authorReference?: Reference;
  authorString?: string;
  time?: string;
  text: string;
}

export interface Attachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

export interface Dosage {
  sequence?: number;
  text?: string;
  additionalInstruction?: CodeableConcept[];
  patientInstruction?: string;
  timing?: {
    event?: string[];
    repeat?: {
      boundsDuration?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
      boundsRange?: {
        low?: Quantity;
        high?: Quantity;
      };
      boundsPeriod?: Period;
      count?: number;
      countMax?: number;
      duration?: number;
      durationMax?: number;
      durationUnit?: string;
      frequency?: number;
      frequencyMax?: number;
      period?: number;
      periodMax?: number;
      periodUnit?: string;
      dayOfWeek?: string[];
      timeOfDay?: string[];
      when?: string[];
      offset?: number;
    };
    code?: CodeableConcept;
  };
  asNeededBoolean?: boolean;
  asNeededCodeableConcept?: CodeableConcept;
  site?: CodeableConcept;
  route?: CodeableConcept;
  method?: CodeableConcept;
  doseAndRate?: Array<{
    type?: CodeableConcept;
    doseRange?: {
      low?: Quantity;
      high?: Quantity;
    };
    doseQuantity?: Quantity;
    rateRatio?: {
      numerator?: Quantity;
      denominator?: Quantity;
    };
    rateRange?: {
      low?: Quantity;
      high?: Quantity;
    };
    rateQuantity?: Quantity;
  }>;
  maxDosePerPeriod?: {
    numerator?: Quantity;
    denominator?: Quantity;
  };
  maxDosePerAdministration?: Quantity;
  maxDosePerLifetime?: Quantity;
}

/**
 * Validation Result Interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Validation Functions
 */
export function validateHumanName(name: HumanName): ValidationResult {
  const errors: string[] = [];
  
  if (!name || typeof name !== 'object') {
    errors.push('HumanName must be a valid object');
    return { valid: false, errors };
  }
  
  if (!name.family && (!name.given || name.given.length === 0)) {
    errors.push('At least family name or given name is required');
  }
  
  if (name.given && name.given.length === 0) {
    errors.push('Given names array cannot be empty');
  }
  
  if (name.use && !['usual', 'official', 'temp', 'nickname', 'anonymous', 'old', 'maiden'].includes(name.use)) {
    errors.push('Invalid name use. Must be one of: usual, official, temp, nickname, anonymous, old, maiden');
  }
  
  // Validate string lengths (reasonable limits)
  const maxNameLength = 255;
  if (name.family && name.family.length > maxNameLength) {
    errors.push('Family name exceeds maximum length');
  }
  
  if (name.text && name.text.length > maxNameLength) {
    errors.push('Name text exceeds maximum length');
  }
  
  // Validate given names array
  if (name.given) {
    name.given.forEach(givenName => {
      if (givenName && givenName.length > maxNameLength) {
        errors.push('Given name exceeds maximum length');
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateAddress(address: Address): ValidationResult {
  const errors: string[] = [];
  
  if (!address || typeof address !== 'object') {
    errors.push('Address must be a valid object');
    return { valid: false, errors };
  }
  
  // Check if address has at least one location field
  const hasLocationData = address.text || 
    (address.line && address.line.length > 0) || 
    address.city || 
    address.state || 
    address.postalCode || 
    address.country;
    
  if (!hasLocationData) {
    errors.push('Address must have at least one of: text, line, city, state, postalCode, or country');
  }
  
  // Validate use field
  if (address.use && !['home', 'work', 'temp', 'old', 'billing'].includes(address.use)) {
    errors.push('Invalid address use. Must be one of: home, work, temp, old, billing');
  }
  
  // Validate type field
  if (address.type && !['postal', 'physical', 'both'].includes(address.type)) {
    errors.push('Invalid address type. Must be one of: postal, physical, both');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateContactPoint(contact: ContactPoint): ValidationResult {
  const errors: string[] = [];
  
  if (!contact || typeof contact !== 'object') {
    errors.push('Contact point must be a valid object');
    return { valid: false, errors };
  }
  
  // Validate system field
  if (contact.system && !['phone', 'fax', 'email', 'pager', 'url', 'sms', 'other'].includes(contact.system)) {
    errors.push('Invalid contact system. Must be one of: phone, fax, email, pager, url, sms, other');
  }
  
  // Validate value is present
  if (!contact.value) {
    errors.push('Contact point value is required');
  }
  
  // Validate email format if system is email
  if (contact.system === 'email' && contact.value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact.value)) {
      errors.push('Invalid email format');
    }
  }
  
  // Validate use field
  if (contact.use && !['home', 'work', 'temp', 'old', 'mobile'].includes(contact.use)) {
    errors.push('Invalid contact use. Must be one of: home, work, temp, old, mobile');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateCodeableConcept(concept: CodeableConcept): ValidationResult {
  const errors: string[] = [];
  
  if (!concept || typeof concept !== 'object') {
    errors.push('CodeableConcept must be a valid object');
    return { valid: false, errors };
  }
  
  if (!concept.text && (!concept.coding || concept.coding.length === 0)) {
    errors.push('CodeableConcept must have either coding or text');
  }
  
  // Validate coding if present
  if (concept.coding && concept.coding.length > 0) {
    concept.coding.forEach((coding, _index) => {
      // A coding must have either both system and code, or just display is not sufficient
      // Based on FHIR specs, display alone without system+code is not a valid coding
      if (!coding.system && !coding.code) {
        errors.push('Coding must have either system+code or display');
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateIdentifier(identifier: Identifier): ValidationResult {
  const errors: string[] = [];
  
  if (!identifier || typeof identifier !== 'object') {
    errors.push('Identifier must be a valid object');
    return { valid: false, errors };
  }
  
  if (!identifier.value) {
    errors.push('Identifier value is required');
  }
  
  // System is optional according to FHIR spec, but useful for validation
  // Only validate use if present
  if (identifier.use && !['usual', 'official', 'temp', 'secondary', 'old'].includes(identifier.use)) {
    errors.push('Invalid identifier use. Must be one of: usual, official, temp, secondary, old');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validatePeriod(period: Period): ValidationResult {
  const errors: string[] = [];
  
  if (!period || typeof period !== 'object') {
    errors.push('Period must be a valid object');
    return { valid: false, errors };
  }
  
  if (!period.start && !period.end) {
    errors.push('Period must have start and/or end');
  }
  
  // Validate date formats
  if (period.start) {
    const startDate = new Date(period.start);
    if (isNaN(startDate.getTime())) {
      errors.push('Invalid start date format');
    }
  }
  
  if (period.end) {
    const endDate = new Date(period.end);
    if (isNaN(endDate.getTime())) {
      errors.push('Invalid end date format');
    }
  }
  
  // Validate that end is after start
  if (period.start && period.end) {
    const startDate = new Date(period.start);
    const endDate = new Date(period.end);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate < startDate) {
      errors.push('Period end must be after start');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateReference(reference: Reference): ValidationResult {
  const errors: string[] = [];
  
  if (!reference || typeof reference !== 'object') {
    errors.push('Reference must be a valid object');
    return { valid: false, errors };
  }
  
  if (!reference.reference && !reference.identifier) {
    errors.push('Reference must have either reference or identifier');
  }
  
  // Validate reference format if present
  if (reference.reference) {
    // Basic FHIR reference format validation
    const referencePattern = /^(https?:\/\/.*\/)?([A-Za-z]+)\/([A-Za-z0-9\-.]+)$/;
    const simplePattern = /^[A-Za-z]+\/[A-Za-z0-9\-.]+$/;
    
    if (!referencePattern.test(reference.reference) && !simplePattern.test(reference.reference)) {
      errors.push('Invalid reference format. Expected format: ResourceType/id or full URL');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateQuantity(quantity: Quantity): ValidationResult {
  const errors: string[] = [];
  
  if (!quantity || typeof quantity !== 'object') {
    errors.push('Quantity must be a valid object');
    return { valid: false, errors };
  }
  
  if (quantity.value === undefined || quantity.value === null) {
    errors.push('Quantity value is required');
  } else if (typeof quantity.value !== 'number' || isNaN(quantity.value)) {
    errors.push('Quantity value must be a valid number');
  }
  
  // Validate comparator if present
  if (quantity.comparator && !['<', '<=', '>=', '>'].includes(quantity.comparator)) {
    errors.push('Invalid comparator. Must be one of: <, <=, >=, >');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Utility Functions
 */
export function createReference(resourceType: string, id: string, display?: string): Reference {
  return {
    reference: `${resourceType}/${id}`,
    display
  };
}

export function formatHumanName(name: HumanName): string {
  const parts: string[] = [];
  if (name.prefix && name.prefix.length > 0) {
    parts.push(name.prefix.join(' '));
  }
  if (name.given && name.given.length > 0) {
    parts.push(name.given.join(' '));
  }
  if (name.family) {
    parts.push(name.family);
  }
  if (name.suffix && name.suffix.length > 0) {
    parts.push(name.suffix.join(' '));
  }
  return parts.join(' ').trim();
}

export function formatAddress(address: Address): string {
  // Use text field if provided
  if (address.text) {
    return address.text;
  }
  
  const parts: string[] = [];
  if (address.line && address.line.length > 0) {
    parts.push(address.line.join(', '));
  }
  if (address.city) {
    parts.push(address.city);
  }
  
  // Combine state and postal code
  const stateZip: string[] = [];
  if (address.state) {
    stateZip.push(address.state);
  }
  if (address.postalCode) {
    stateZip.push(address.postalCode);
  }
  if (stateZip.length > 0) {
    parts.push(stateZip.join(' '));
  }
  
  if (address.country) {
    parts.push(address.country);
  }
  return parts.join(', ');
}