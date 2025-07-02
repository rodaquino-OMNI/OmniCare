/**
 * OmniCare EMR Backend - Insurance Entity
 * TypeORM entity for Patient Insurance Information
 */

import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate
} from 'typeorm';

import { HIPAACompliantEntity } from './base.entity';
import { PatientEntity } from './patient.entity';

@Entity('patient_insurance')
@Index(['patientId', 'priority'])
@Index(['active', 'priority'])
@Index(['payorId'])
export class InsuranceEntity extends HIPAACompliantEntity {
  // Link to patient
  @ManyToOne(() => PatientEntity, patient => patient.insurance, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: PatientEntity;

  @Column({
    type: 'uuid'
  })
  @Index()
  patientId!: string;

  // Subscriber ID
  @Column({
    type: 'varchar',
    length: 100
  })
  subscriberId!: string;

  // Payor information
  @Column({
    type: 'varchar',
    length: 255
  })
  @Index()
  payorName!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true
  })
  @Index()
  payorId?: string;

  // Plan information
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  planName?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true
  })
  planId?: string;

  // Group information
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true
  })
  groupNumber?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  groupName?: string;

  // Policy number
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true
  })
  policyNumber?: string;

  // Relationship to subscriber
  @Column({
    type: 'varchar',
    length: 50,
    default: 'self'
  })
  relationshipToSubscriber!: 'self' | 'spouse' | 'child' | 'parent' | 'other';

  // Coverage dates
  @Column({
    type: 'date'
  })
  effectiveDate!: Date;

  @Column({
    type: 'date',
    nullable: true
  })
  terminationDate?: Date;

  // Financial information
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true
  })
  copayAmount?: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true
  })
  deductibleAmount?: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true
  })
  outOfPocketMaximum?: number;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true
  })
  coinsurancePercentage?: number;

  // Coverage type
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true
  })
  coverageType?: 'medical' | 'dental' | 'vision' | 'pharmacy' | 'mental-health' | 'other';

  // Network information
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true
  })
  networkId?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  networkName?: string;

  // Active status
  @Column({
    type: 'boolean',
    default: true
  })
  @Index()
  active!: boolean;

  // Priority (1 = primary, 2 = secondary, etc.)
  @Column({
    type: 'integer',
    default: 1
  })
  @Index()
  priority!: number;

  // Verification status
  @Column({
    type: 'varchar',
    length: 20,
    default: 'unverified'
  })
  verificationStatus!: 'verified' | 'unverified' | 'pending' | 'failed';

  @Column({
    type: 'timestamp with time zone',
    nullable: true
  })
  lastVerificationDate?: Date;

  @Column({
    type: 'timestamp with time zone',
    nullable: true
  })
  nextVerificationDate?: Date;

  // Subscriber information (if different from patient)
  @Column({
    type: 'jsonb',
    nullable: true
  })
  subscriberInfo?: {
    name?: {
      family?: string;
      given?: string[];
    };
    birthDate?: string;
    gender?: 'male' | 'female' | 'other' | 'unknown';
    address?: {
      line?: string[];
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    identifier?: {
      system?: string;
      value?: string;
    };
  };

  // Benefits information
  @Column({
    type: 'jsonb',
    nullable: true
  })
  benefits?: {
    deductibleMet?: boolean;
    deductibleRemaining?: number;
    outOfPocketMet?: boolean;
    outOfPocketRemaining?: number;
    coverageDetails?: Array<{
      service: string;
      covered: boolean;
      copay?: number;
      coinsurance?: number;
      deductible?: boolean;
      notes?: string;
    }>;
  };

  // Prior authorization requirements
  @Column({
    type: 'jsonb',
    nullable: true
  })
  priorAuthRequirements?: {
    required: boolean;
    services?: string[];
    contactInfo?: {
      phone?: string;
      fax?: string;
      email?: string;
      website?: string;
    };
  };

  // Electronic data
  @Column({
    type: 'jsonb',
    nullable: true
  })
  electronicData?: {
    eligibilityResponseRaw?: Record<string, unknown>;
    benefitsResponseRaw?: Record<string, unknown>;
    lastEligibilityCheck?: string;
    transactionControlNumber?: string;
  };

  // Notes
  @Column({
    type: 'text',
    nullable: true
  })
  notes?: string;

  // Computed fields
  get isActive(): boolean {
    const now = new Date();
    const effective = new Date(this.effectiveDate);
    const termination = this.terminationDate ? new Date(this.terminationDate) : null;
    
    return this.active && 
           effective <= now && 
           (!termination || termination >= now);
  }

  get isPrimary(): boolean {
    return this.priority === 1;
  }

  get isSecondary(): boolean {
    return this.priority === 2;
  }

  get displayName(): string {
    return this.planName || this.payorName;
  }

  // Lifecycle hooks
  @BeforeInsert()
  @BeforeUpdate()
  updateFields() {
    // Set next verification date if not set
    if (this.lastVerificationDate && !this.nextVerificationDate) {
      const nextVerification = new Date(this.lastVerificationDate);
      nextVerification.setMonth(nextVerification.getMonth() + 3); // 3 months from last verification
      this.nextVerificationDate = nextVerification;
    }

    // Mark PHI fields as encrypted
    this.markFieldEncrypted('subscriberId');
    this.markFieldEncrypted('subscriberInfo');
    this.markFieldEncrypted('benefits');
  }

  // Methods
  needsVerification(): boolean {
    if (!this.nextVerificationDate) return true;
    return new Date() >= this.nextVerificationDate;
  }

  updateVerificationStatus(status: InsuranceEntity['verificationStatus'], notes?: string): void {
    this.verificationStatus = status;
    this.lastVerificationDate = new Date();
    
    // Set next verification date based on status
    const nextVerification = new Date();
    if (status === 'verified') {
      nextVerification.setMonth(nextVerification.getMonth() + 6); // 6 months for successful verification
    } else {
      nextVerification.setMonth(nextVerification.getMonth() + 1); // 1 month for failed verification
    }
    this.nextVerificationDate = nextVerification;
    
    if (notes) {
      this.notes = notes;
    }
  }

  // Validation
  validate(): string[] {
    const errors = super.validate();

    if (!this.patientId) {
      errors.push('Patient ID is required');
    }

    if (!this.subscriberId) {
      errors.push('Subscriber ID is required');
    }

    if (!this.payorName) {
      errors.push('Payor name is required');
    }

    if (!this.effectiveDate) {
      errors.push('Effective date is required');
    }

    if (this.priority < 1) {
      errors.push('Priority must be at least 1');
    }

    if (this.terminationDate && this.effectiveDate) {
      if (new Date(this.terminationDate) <= new Date(this.effectiveDate)) {
        errors.push('Termination date must be after effective date');
      }
    }

    if (this.copayAmount && this.copayAmount < 0) {
      errors.push('Copay amount cannot be negative');
    }

    if (this.deductibleAmount && this.deductibleAmount < 0) {
      errors.push('Deductible amount cannot be negative');
    }

    if (this.coinsurancePercentage && (this.coinsurancePercentage < 0 || this.coinsurancePercentage > 1)) {
      errors.push('Coinsurance percentage must be between 0 and 1');
    }

    return errors;
  }
}