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
  contained?: any[];
  extension?: Array<{
    url: string;
    valueString?: string;
    valueCode?: string;
    valueDateTime?: string;
    valueBoolean?: boolean;
    valueInteger?: number;
    valueDecimal?: number;
    [key: string]: any;
  }>;
  modifierExtension?: Array<{
    url: string;
    [key: string]: any;
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

export interface CodeableConcept {
  coding?: Array<{
    system?: string;
    version?: string;
    code?: string;
    display?: string;
    userSelected?: boolean;
  }>;
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
}

/**
 * Validation Functions
 */
export function validateHumanName(name: HumanName): ValidationResult {
  const errors: string[] = [];
  
  if (!name.family && (!name.given || name.given.length === 0)) {
    errors.push('At least family name or given name is required');
  }
  
  if (name.given && name.given.length === 0) {
    errors.push('Given names array cannot be empty');
  }
  
  if (name.use && !['usual', 'official', 'temp', 'nickname', 'anonymous', 'old', 'maiden'].includes(name.use)) {
    errors.push('Invalid name use. Must be one of: usual, official, temp, nickname, anonymous, old, maiden');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateAddress(address: Address): ValidationResult {
  const errors: string[] = [];
  
  if (!address.line || address.line.length === 0) {
    errors.push('Address line is required');
  }
  
  if (!address.city) {
    errors.push('City is required');
  }
  
  if (!address.country) {
    errors.push('Country is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateContactPoint(contact: ContactPoint): ValidationResult {
  const errors: string[] = [];
  
  if (!contact.system) {
    errors.push('Contact system is required');
  }
  
  if (!contact.value) {
    errors.push('Contact value is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateCodeableConcept(concept: CodeableConcept): ValidationResult {
  const errors: string[] = [];
  
  if (!concept.text && (!concept.coding || concept.coding.length === 0)) {
    errors.push('Either text or coding is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateIdentifier(identifier: Identifier): ValidationResult {
  const errors: string[] = [];
  
  if (!identifier.value) {
    errors.push('Identifier value is required');
  }
  
  if (!identifier.system) {
    errors.push('Identifier system is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validatePeriod(period: Period): ValidationResult {
  const errors: string[] = [];
  
  if (!period.start && !period.end) {
    errors.push('Either start or end date is required');
  }
  
  if (period.start && period.end) {
    const startDate = new Date(period.start);
    const endDate = new Date(period.end);
    if (startDate > endDate) {
      errors.push('Start date cannot be after end date');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateReference(reference: Reference): ValidationResult {
  const errors: string[] = [];
  
  if (!reference.reference && !reference.identifier) {
    errors.push('Either reference or identifier is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateQuantity(quantity: Quantity): ValidationResult {
  const errors: string[] = [];
  
  if (typeof quantity.value !== 'number' || isNaN(quantity.value)) {
    errors.push('Quantity value must be a valid number');
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
  const parts: string[] = [];
  if (address.line && address.line.length > 0) {
    parts.push(address.line.join(', '));
  }
  if (address.city) {
    parts.push(address.city);
  }
  if (address.state) {
    parts.push(address.state);
  }
  if (address.postalCode) {
    parts.push(address.postalCode);
  }
  if (address.country) {
    parts.push(address.country);
  }
  return parts.join(', ');
}