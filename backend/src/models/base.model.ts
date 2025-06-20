/**
 * Base Model Interface
 * Common fields and methods shared across all OmniCare entities
 */

export interface BaseModel {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version?: number;
  active: boolean;
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