/**
 * OmniCare EMR Backend - Patient Contact Entity
 * TypeORM entity for Patient Emergency Contacts
 */

import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn
} from 'typeorm';

import { HIPAACompliantEntity } from './base.entity';
import { PatientEntity, HumanName, Address, ContactPoint } from './patient.entity';

@Entity('patient_contacts')
@Index(['patientId', 'priority'])
@Index(['active', 'priority'])
export class PatientContactEntity extends HIPAACompliantEntity {
  // Link to patient
  @ManyToOne(() => PatientEntity, patient => patient.contacts, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: PatientEntity;

  @Column({
    type: 'uuid'
  })
  @Index()
  patientId!: string;

  // Contact type
  @Column({
    type: 'varchar',
    length: 50,
    default: 'emergency'
  })
  contactType!: 'emergency' | 'next-of-kin' | 'insurance' | 'employer' | 'other';

  // Relationship to patient
  @Column({
    type: 'varchar',
    length: 100
  })
  relationship!: string;

  // Contact name
  @Column({
    type: 'jsonb'
  })
  name!: HumanName;

  // Contact information
  @Column({
    type: 'jsonb'
  })
  telecom!: ContactPoint[];

  // Address
  @Column({
    type: 'jsonb',
    nullable: true
  })
  address?: Address;

  // Gender
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true
  })
  gender?: 'male' | 'female' | 'other' | 'unknown';

  // Priority (1 = primary, 2 = secondary, etc.)
  @Column({
    type: 'integer',
    default: 1
  })
  @Index()
  priority!: number;

  // Active status
  @Column({
    type: 'boolean',
    default: true
  })
  @Index()
  active!: boolean;

  // Period of validity
  @Column({
    type: 'timestamp with time zone',
    nullable: true
  })
  validFrom?: Date;

  @Column({
    type: 'timestamp with time zone',
    nullable: true
  })
  validTo?: Date;

  // Organization reference (if applicable)
  @Column({
    type: 'uuid',
    nullable: true
  })
  organizationId?: string;

  // Additional notes
  @Column({
    type: 'text',
    nullable: true
  })
  notes?: string;

  // Preferred contact method
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true
  })
  preferredContactMethod?: 'phone' | 'email' | 'sms' | 'mail';

  // Language preference
  @Column({
    type: 'varchar',
    length: 10,
    nullable: true
  })
  preferredLanguage?: string;

  // Full name getter
  get fullName(): string {
    if (!this.name) return '';
    const given = this.name.given?.join(' ') || '';
    const family = this.name.family || '';
    return `${given} ${family}`.trim();
  }

  // Primary phone getter
  get primaryPhone(): string | null {
    if (!this.telecom || this.telecom.length === 0) return null;
    const phone = this.telecom.find(t => t.system === 'phone' && t.use === 'home') ||
                  this.telecom.find(t => t.system === 'phone' && t.use === 'mobile') ||
                  this.telecom.find(t => t.system === 'phone');
    return phone?.value || null;
  }

  // Primary email getter
  get primaryEmail(): string | null {
    if (!this.telecom || this.telecom.length === 0) return null;
    const email = this.telecom.find(t => t.system === 'email');
    return email?.value || null;
  }

  // Validation
  validate(): string[] {
    const errors = super.validate();

    if (!this.patientId) {
      errors.push('Patient ID is required');
    }

    if (!this.relationship) {
      errors.push('Relationship is required');
    }

    if (!this.name) {
      errors.push('Contact name is required');
    }

    if (!this.telecom || this.telecom.length === 0) {
      errors.push('At least one contact method is required');
    }

    if (this.priority < 1) {
      errors.push('Priority must be at least 1');
    }

    // Validate contact information
    if (this.telecom) {
      this.telecom.forEach((contact, index) => {
        if (!contact.system || !contact.value) {
          errors.push(`Contact ${index + 1} must have system and value`);
        }
        if (contact.system === 'email' && !this.isValidEmail(contact.value)) {
          errors.push(`Contact ${index + 1} has invalid email format`);
        }
      });
    }

    return errors;
  }

  private isValidEmail(email?: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}