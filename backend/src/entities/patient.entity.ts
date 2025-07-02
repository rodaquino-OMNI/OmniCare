/**
 * OmniCare EMR Backend - Patient Entity
 * TypeORM entity for Patient resource
 */

import {
  Entity,
  Column,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate
} from 'typeorm';

import { HIPAACompliantEntity } from './base.entity';
import { InsuranceEntity } from './insurance.entity';
import { OrganizationEntity } from './organization.entity';
import { PatientAlertEntity } from './patient-alert.entity';
import { PatientContactEntity } from './patient-contact.entity';

// FHIR types
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

export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: {
    coding?: Array<{
      system?: string;
      version?: string;
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

@Entity('patients')
@Index(['omnicarePatientId'], { unique: true })
@Index(['birthDate', 'lastName'])
@Index(['active', 'createdAt'])
export class PatientEntity extends HIPAACompliantEntity {
  // FHIR Resource Type
  @Column({
    type: 'varchar',
    length: 50,
    default: 'Patient'
  })
  resourceType!: string;

  // OmniCare specific ID
  @Column({
    type: 'varchar',
    length: 100,
    unique: true
  })
  omnicarePatientId!: string;

  // FHIR Identifiers
  @Column({
    type: 'jsonb',
    nullable: true
  })
  identifier?: Identifier[];

  // Active status
  @Column({
    type: 'boolean',
    default: true
  })
  @Index()
  active!: boolean;

  // Name information
  @Column({
    type: 'jsonb',
    nullable: true
  })
  name?: HumanName[];

  // Computed fields for searching
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  @Index()
  firstName?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  @Index()
  lastName?: string;

  // Contact information
  @Column({
    type: 'jsonb',
    nullable: true
  })
  telecom?: ContactPoint[];

  // Demographics
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true
  })
  @Index()
  gender?: 'male' | 'female' | 'other' | 'unknown';

  @Column({
    type: 'date',
    nullable: true
  })
  @Index()
  birthDate?: Date;

  @Column({
    type: 'boolean',
    default: false
  })
  deceasedBoolean!: boolean;

  @Column({
    type: 'timestamp with time zone',
    nullable: true
  })
  deceasedDateTime?: Date;

  // Address information
  @Column({
    type: 'jsonb',
    nullable: true
  })
  address?: Address[];

  // Marital status
  @Column({
    type: 'jsonb',
    nullable: true
  })
  maritalStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };

  // Multiple birth
  @Column({
    type: 'boolean',
    nullable: true
  })
  multipleBirthBoolean?: boolean;

  @Column({
    type: 'integer',
    nullable: true
  })
  multipleBirthInteger?: number;

  // Photo
  @Column({
    type: 'jsonb',
    nullable: true
  })
  photo?: Array<{
    contentType?: string;
    language?: string;
    data?: string;
    url?: string;
    size?: number;
    hash?: string;
    title?: string;
    creation?: string;
  }>;

  // Communication preferences
  @Column({
    type: 'jsonb',
    nullable: true
  })
  communication?: Array<{
    language: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    preferred?: boolean;
  }>;

  // General practitioner references
  @Column({
    type: 'jsonb',
    nullable: true
  })
  generalPractitioner?: Array<{
    reference?: string;
    type?: string;
    identifier?: Identifier;
    display?: string;
  }>;

  // Managing organization
  @ManyToOne(() => OrganizationEntity, { nullable: true })
  @JoinColumn({ name: 'managing_organization_id' })
  managingOrganization?: OrganizationEntity;

  @Column({
    type: 'uuid',
    nullable: true
  })
  managingOrganizationId?: string;

  // Registration date
  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP'
  })
  @Index()
  registrationDate!: Date;

  // Preferred language
  @Column({
    type: 'varchar',
    length: 10,
    nullable: true
  })
  preferredLanguage?: string;

  // Extended demographics
  @Column({
    type: 'jsonb',
    nullable: true
  })
  demographics?: {
    race?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    ethnicity?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    religion?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    nationality?: string;
    birthPlace?: Address;
    occupation?: string;
    educationLevel?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    disability?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
  };

  // Preferences
  @Column({
    type: 'jsonb',
    nullable: true
  })
  preferences?: {
    communicationPreferences?: {
      preferredLanguage?: string;
      interpreterRequired?: boolean;
      communicationMethod?: 'phone' | 'email' | 'sms' | 'portal' | 'mail';
      appointmentReminders?: boolean;
      labResultsDelivery?: 'phone' | 'email' | 'portal' | 'mail';
    };
    treatmentPreferences?: {
      advanceDirectives?: Array<{
        reference?: string;
        display?: string;
      }>;
      organDonor?: boolean;
      resuscitationStatus?: 'full-code' | 'dnr' | 'dnar' | 'comfort-care';
      emergencyTreatmentConsent?: boolean;
    };
    privacyPreferences?: {
      shareWithFamily?: boolean;
      shareWithEmergencyContact?: boolean;
      marketingOptOut?: boolean;
      researchParticipation?: boolean;
    };
  };

  // Accessibility needs
  @Column({
    type: 'jsonb',
    nullable: true
  })
  accessibilityNeeds?: {
    physicalDisability?: string[];
    cognitiveNeeds?: string[];
    sensoryImpairments?: string[];
    assistiveDevices?: string[];
    accommodationRequests?: string[];
    transportationNeeds?: string;
  };

  // Social history
  @Column({
    type: 'jsonb',
    nullable: true
  })
  socialHistory?: {
    smokingStatus?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    alcoholUse?: {
      status: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
      frequency?: string;
      quantity?: string;
    };
    substanceUse?: Array<{
      substance: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
      status: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
      frequency?: string;
    }>;
    sexualHistory?: {
      sexuallyActive?: boolean;
      partners?: number;
      orientation?: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
    };
    dietaryRestrictions?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    exerciseHabits?: {
      frequency?: string;
      type?: string[];
      intensity?: 'low' | 'moderate' | 'high';
    };
    livingArrangement?: {
      type: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
      supportSystem?: string[];
      livingAlone?: boolean;
    };
    employmentStatus?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    veteranStatus?: boolean;
  };

  // Family history
  @Column({
    type: 'jsonb',
    nullable: true
  })
  familyHistory?: Array<{
    id?: string;
    relationship: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    name?: string;
    gender?: 'male' | 'female' | 'other' | 'unknown';
    bornDate?: string;
    ageAtDeath?: number;
    causeOfDeath?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    conditions?: Array<{
      condition: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
      onset?: {
        ageAtOnset?: number;
        onsetDateTime?: string;
      };
      note?: string;
    }>;
    deceased?: boolean;
  }>;

  // Related entities
  @OneToMany(() => PatientContactEntity, contact => contact.patient, {
    cascade: true,
    eager: false
  })
  contacts?: PatientContactEntity[];

  @OneToMany(() => InsuranceEntity, insurance => insurance.patient, {
    cascade: true,
    eager: false
  })
  insurance?: InsuranceEntity[];

  @OneToMany(() => PatientAlertEntity, alert => alert.patient, {
    cascade: true,
    eager: false
  })
  alerts?: PatientAlertEntity[];

  // Computed age field
  get age(): number | null {
    if (!this.birthDate) return null;
    const today = new Date();
    const birthDate = new Date(this.birthDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  // Full name getter
  get fullName(): string {
    if (!this.name || this.name.length === 0) return '';
    const primaryName = this.name.find(n => n.use === 'official') || this.name[0];
    if (!primaryName) return '';
    
    const given = primaryName.given?.join(' ') || '';
    const family = primaryName.family || '';
    return `${given} ${family}`.trim();
  }

  // Lifecycle hooks
  @BeforeInsert()
  @BeforeUpdate()
  updateComputedFields() {
    // Update firstName and lastName for efficient searching
    if (this.name && this.name.length > 0) {
      const primaryName = this.name.find(n => n.use === 'official') || this.name[0];
      if (primaryName) {
        this.firstName = primaryName.given?.[0] || undefined;
        this.lastName = primaryName.family || undefined;
      }
    }

    // Generate OmniCare Patient ID if not provided
    if (!this.omnicarePatientId) {
      const prefix = 'OMC';
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      this.omnicarePatientId = `${prefix}-${timestamp}-${random}`;
    }

    // Mark PHI fields as encrypted
    this.markFieldEncrypted('name');
    this.markFieldEncrypted('telecom');
    this.markFieldEncrypted('address');
    this.markFieldEncrypted('socialHistory');
  }

  // Validation
  validate(): string[] {
    const errors = super.validate();

    if (!this.omnicarePatientId) {
      errors.push('OmniCare Patient ID is required');
    }

    if (!this.name || this.name.length === 0) {
      errors.push('Patient name is required');
    }

    if (this.birthDate) {
      const birthDate = new Date(this.birthDate);
      if (birthDate > new Date()) {
        errors.push('Birth date cannot be in the future');
      }
    }

    return errors;
  }
}