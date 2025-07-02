/**
 * OmniCare EMR Backend - Organization Entity
 * TypeORM entity for Organization resource
 */

import {
  Entity,
  Column,
  Index,
  OneToMany,
  BeforeInsert,
  BeforeUpdate
} from 'typeorm';

import { HIPAACompliantEntity } from './base.entity';
import { PatientEntity } from './patient.entity';

// FHIR types for Organization
export interface OrganizationIdentifier {
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

export interface OrganizationTelecom {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: {
    start?: string;
    end?: string;
  };
}

export interface OrganizationAddress {
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

export interface OrganizationContact {
  purpose?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  name?: {
    use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
    text?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
  };
  telecom?: OrganizationTelecom[];
  address?: OrganizationAddress;
}

@Entity('organizations')
@Index(['npi'], { unique: true, where: 'npi IS NOT NULL' })
@Index(['active', 'organizationType'])
@Index(['name'])
export class OrganizationEntity extends HIPAACompliantEntity {
  // FHIR Resource Type
  @Column({
    type: 'varchar',
    length: 50,
    default: 'Organization'
  })
  resourceType!: string;

  // FHIR Identifiers
  @Column({
    type: 'jsonb',
    nullable: true
  })
  identifier?: OrganizationIdentifier[];

  // NPI (National Provider Identifier)
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    unique: true
  })
  npi?: string;

  // Active status
  @Column({
    type: 'boolean',
    default: true
  })
  @Index()
  active!: boolean;

  // Organization type
  @Column({
    type: 'jsonb',
    nullable: true
  })
  type?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;

  // Computed organization type for searching
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true
  })
  @Index()
  organizationType?: string;

  // Organization name
  @Column({
    type: 'varchar',
    length: 255
  })
  @Index()
  name!: string;

  // Alternative names
  @Column({
    type: 'jsonb',
    nullable: true
  })
  alias?: string[];

  // Contact information
  @Column({
    type: 'jsonb',
    nullable: true
  })
  telecom?: OrganizationTelecom[];

  // Address information
  @Column({
    type: 'jsonb',
    nullable: true
  })
  address?: OrganizationAddress[];

  // Organization contacts
  @Column({
    type: 'jsonb',
    nullable: true
  })
  contact?: OrganizationContact[];

  // Part of another organization
  @Column({
    type: 'jsonb',
    nullable: true
  })
  partOf?: {
    reference?: string;
    type?: string;
    identifier?: OrganizationIdentifier;
    display?: string;
  };

  // Organization endpoints
  @Column({
    type: 'jsonb',
    nullable: true
  })
  endpoint?: Array<{
    reference?: string;
    type?: string;
    identifier?: OrganizationIdentifier;
    display?: string;
  }>;

  // Organization qualifications
  @Column({
    type: 'jsonb',
    nullable: true
  })
  qualification?: Array<{
    identifier?: OrganizationIdentifier[];
    code: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    period?: {
      start?: string;
      end?: string;
    };
    issuer?: {
      reference?: string;
      display?: string;
    };
  }>;

  // Business information
  @Column({
    type: 'jsonb',
    nullable: true
  })
  businessInfo?: {
    taxId?: string;
    licenseNumber?: string;
    accreditationStatus?: string;
    establishedDate?: string;
    website?: string;
    description?: string;
    specialties?: string[];
    services?: string[];
    operatingHours?: {
      monday?: string;
      tuesday?: string;
      wednesday?: string;
      thursday?: string;
      friday?: string;
      saturday?: string;
      sunday?: string;
    };
    emergencyContact?: {
      name?: string;
      phone?: string;
      email?: string;
    };
  };

  // Insurance and financial information
  @Column({
    type: 'jsonb',
    nullable: true
  })
  insuranceInfo?: {
    acceptedInsurance?: string[];
    billingAddress?: OrganizationAddress;
    taxId?: string;
    payerIds?: Array<{
      payerName: string;
      payerId: string;
      status: 'active' | 'inactive';
    }>;
  };

  // Technology and integration
  @Column({
    type: 'jsonb',
    nullable: true
  })
  integrationInfo?: {
    ehrSystem?: string;
    fhirEndpoint?: string;
    apiKey?: string;
    supportedProfiles?: string[];
    lastSyncDate?: string;
    syncStatus?: 'active' | 'inactive' | 'error';
  };

  // Related entities
  @OneToMany(() => PatientEntity, patient => patient.managingOrganization)
  patients?: PatientEntity[];

  // Lifecycle hooks
  @BeforeInsert()
  @BeforeUpdate()
  updateComputedFields() {
    // Update organizationType for efficient searching
    if (this.type && this.type.length > 0) {
      const primaryType = this.type[0];
      if (primaryType && primaryType.coding && primaryType.coding.length > 0) {
        this.organizationType = primaryType.coding[0]?.code || primaryType.coding[0]?.display;
      } else if (primaryType && primaryType.text) {
        this.organizationType = primaryType.text;
      }
    }

    // Mark sensitive fields as encrypted
    this.markFieldEncrypted('telecom');
    this.markFieldEncrypted('address');
    this.markFieldEncrypted('contact');
    this.markFieldEncrypted('businessInfo');
    this.markFieldEncrypted('insuranceInfo');
    this.markFieldEncrypted('integrationInfo');
  }

  // Validation
  validate(): string[] {
    const errors = super.validate();

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Organization name is required');
    }

    if (this.npi && !/^\d{10}$/.test(this.npi)) {
      errors.push('NPI must be a 10-digit number');
    }

    // Validate contact information
    if (this.telecom) {
      for (const contact of this.telecom) {
        if (contact.system === 'email' && contact.value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(contact.value)) {
            errors.push('Invalid email format in telecom');
          }
        }
        if (contact.system === 'phone' && contact.value) {
          const phoneRegex = /^[\d\s\-()+.]+$/;
          if (!phoneRegex.test(contact.value)) {
            errors.push('Invalid phone format in telecom');
          }
        }
      }
    }

    return errors;
  }

  // Helper methods
  get primaryPhone(): string | undefined {
    const phoneContact = this.telecom?.find(t => t.system === 'phone' && t.use === 'work');
    return phoneContact?.value || this.telecom?.find(t => t.system === 'phone')?.value;
  }

  get primaryEmail(): string | undefined {
    const emailContact = this.telecom?.find(t => t.system === 'email' && t.use === 'work');
    return emailContact?.value || this.telecom?.find(t => t.system === 'email')?.value;
  }

  get primaryAddress(): OrganizationAddress | undefined {
    return this.address?.find(a => a.use === 'work') || this.address?.[0];
  }

  get displayName(): string {
    return this.name;
  }

  get isHealthcareProvider(): boolean {
    return this.organizationType?.toLowerCase().includes('provider') ||
           this.organizationType?.toLowerCase().includes('hospital') ||
           this.organizationType?.toLowerCase().includes('clinic') ||
           false;
  }
}