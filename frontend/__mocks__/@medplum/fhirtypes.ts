// Mock for @medplum/fhirtypes

// Mock FHIR resource types
export interface Resource {
  resourceType: string;
  id?: string;
  meta?: any;
}

export interface DomainResource extends Resource {
  text?: any;
  contained?: Resource[];
  extension?: any[];
  modifierExtension?: any[];
}

export interface ContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: any;
}

export interface Patient extends DomainResource {
  resourceType: 'Patient';
  identifier?: any[];
  active?: boolean;
  name?: any[];
  telecom?: ContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: any[];
  maritalStatus?: any;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  photo?: any[];
  contact?: any[];
  communication?: any[];
  generalPractitioner?: any[];
  managingOrganization?: any;
  link?: any[];
}

export interface Practitioner extends DomainResource {
  resourceType: 'Practitioner';
  identifier?: any[];
  active?: boolean;
  name?: any[];
  telecom?: any[];
  address?: any[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  photo?: any[];
  qualification?: any[];
  communication?: any[];
}

export interface Task extends DomainResource {
  resourceType: 'Task';
  identifier?: any[];
  instantiatesCanonical?: string;
  instantiatesUri?: string;
  basedOn?: any[];
  groupIdentifier?: any;
  partOf?: any[];
  status: 'draft' | 'requested' | 'received' | 'accepted' | 'rejected' | 'ready' | 'cancelled' | 'in-progress' | 'on-hold' | 'failed' | 'completed' | 'entered-in-error';
  statusReason?: any;
  businessStatus?: any;
  intent: string;
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  code?: any;
  description?: string;
  focus?: any;
  for?: any;
  encounter?: any;
  executionPeriod?: any;
  authoredOn?: string;
  lastModified?: string;
  requester?: any;
  performerType?: any[];
  owner?: any;
  reasonCode?: any;
  reasonReference?: any;
  insurance?: any[];
  note?: any[];
  relevantHistory?: any[];
  restriction?: any;
  input?: any[];
  output?: any[];
}

export interface Observation extends DomainResource {
  resourceType: 'Observation';
  identifier?: any[];
  basedOn?: any[];
  partOf?: any[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: any[];
  code: any;
  subject?: any;
  focus?: any[];
  encounter?: any;
  effectiveDateTime?: string;
  effectivePeriod?: any;
  effectiveTiming?: any;
  effectiveInstant?: string;
  issued?: string;
  performer?: any[];
  valueQuantity?: any;
  valueCodeableConcept?: any;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: any;
  valueRatio?: any;
  valueSampledData?: any;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: any;
  dataAbsentReason?: any;
  interpretation?: any[];
  note?: any[];
  bodySite?: any;
  method?: any;
  specimen?: any;
  device?: any;
  referenceRange?: any[];
  hasMember?: any[];
  derivedFrom?: any[];
  component?: any[];
}

export interface Bundle extends Resource {
  resourceType: 'Bundle';
  identifier?: any;
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  timestamp?: string;
  total?: number;
  link?: any[];
  entry?: any[];
  signature?: any;
}

export interface Reference {
  reference?: string;
  type?: string;
  identifier?: any;
  display?: string;
}

export interface CodeableConcept {
  coding?: any[];
  text?: string;
}

export interface HumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: any;
}

export interface ContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: any;
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
  period?: any;
}

export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: any;
  system?: string;
  value?: string;
  period?: any;
  assigner?: any;
}

export interface Period {
  start?: string;
  end?: string;
}

export interface Annotation {
  authorReference?: any;
  authorString?: string;
  time?: string;
  text: string;
}