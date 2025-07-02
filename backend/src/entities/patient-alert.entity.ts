/**
 * OmniCare EMR Backend - Patient Alert Entity
 * TypeORM entity for Patient Alert resource
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

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 'allergy' | 'medication' | 'condition' | 'procedure' | 'general';
export type AlertStatus = 'active' | 'inactive' | 'resolved';

@Entity('patient_alerts')
@Index(['patientId', 'active'])
@Index(['alertType', 'severity'])
@Index(['expiresAt'])
export class PatientAlertEntity extends HIPAACompliantEntity {
  // Alert details
  @Column({
    type: 'varchar',
    length: 255
  })
  title!: string;

  @Column({
    type: 'text',
    nullable: true
  })
  description?: string;

  @Column({
    type: 'varchar',
    length: 50
  })
  @Index()
  alertType!: AlertType;

  @Column({
    type: 'varchar',
    length: 20
  })
  @Index()
  severity!: AlertSeverity;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active'
  })
  @Index()
  status!: AlertStatus;

  @Column({
    type: 'boolean',
    default: true
  })
  @Index()
  active!: boolean;

  // Patient relationship
  @ManyToOne(() => PatientEntity, patient => patient.alerts, { 
    onDelete: 'CASCADE' 
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: PatientEntity;

  @Column({
    type: 'uuid'
  })
  @Index()
  patientId!: string;

  // Alert timing
  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP'
  })
  alertDate!: Date;

  @Column({
    type: 'timestamp with time zone',
    nullable: true
  })
  expiresAt?: Date;

  @Column({
    type: 'timestamp with time zone',
    nullable: true
  })
  acknowledgedAt?: Date;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  acknowledgedBy?: string;

  // Additional metadata
  @Column({
    type: 'jsonb',
    nullable: true
  })
  declare metadata?: {
    sourceSystem?: string;
    sourceId?: string;
    clinicalCodes?: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    relatedResources?: Array<{
      resourceType: string;
      resourceId: string;
      relationship: string;
    }>;
    displayRules?: {
      showInSummary?: boolean;
      requireAcknowledgment?: boolean;
      alertColor?: string;
      alertIcon?: string;
    };
  };

  // Lifecycle hooks
  @BeforeInsert()
  @BeforeUpdate()
  updateComputedFields() {
    // Mark sensitive fields as encrypted
    this.markFieldEncrypted('description');
    this.markFieldEncrypted('metadata');
  }

  // Validation
  validate(): string[] {
    const errors = super.validate();

    if (!this.title || this.title.trim().length === 0) {
      errors.push('Alert title is required');
    }

    if (!this.patientId) {
      errors.push('Patient ID is required');
    }

    if (!['low', 'medium', 'high', 'critical'].includes(this.severity)) {
      errors.push('Invalid alert severity');
    }

    if (!['allergy', 'medication', 'condition', 'procedure', 'general'].includes(this.alertType)) {
      errors.push('Invalid alert type');
    }

    if (this.expiresAt && this.expiresAt <= new Date()) {
      errors.push('Expiration date must be in the future');
    }

    return errors;
  }

  // Helper methods
  get isExpired(): boolean {
    return this.expiresAt ? this.expiresAt <= new Date() : false;
  }

  get isAcknowledged(): boolean {
    return !!this.acknowledgedAt;
  }

  get displayPriority(): number {
    switch (this.severity) {
      case 'critical': return 1;
      case 'high': return 2;
      case 'medium': return 3;
      case 'low': return 4;
      default: return 5;
    }
  }
}