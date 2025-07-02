/**
 * OmniCare EMR Backend - Base Entity
 * Base class for all TypeORM entities
 */

import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity as TypeOrmBaseEntity,
  BeforeInsert,
  BeforeUpdate,
  AfterLoad,
  Column,
  Index
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseEntity extends TypeOrmBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP'
  })
  @Index()
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP'
  })
  @Index()
  updatedAt!: Date;

  @Column({
    type: 'timestamp with time zone',
    nullable: true
  })
  deletedAt?: Date;

  // Soft delete flag
  @Column({
    type: 'boolean',
    default: false
  })
  @Index()
  isDeleted!: boolean;

  // Version for optimistic locking
  @Column({
    type: 'integer',
    default: 1
  })
  version!: number;

  // Audit fields
  @Column({
    type: 'uuid',
    nullable: true
  })
  createdBy?: string;

  @Column({
    type: 'uuid',
    nullable: true
  })
  updatedBy?: string;

  // Transaction tracking
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  lastTransactionId?: string;

  // Metadata for extensions
  @Column({
    type: 'jsonb',
    nullable: true,
    default: {}
  })
  metadata?: Record<string, unknown>;

  // Lifecycle hooks
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  @BeforeUpdate()
  incrementVersion() {
    this.version += 1;
  }

  @AfterLoad()
  cleanupData() {
    // Remove null/undefined fields from JSON columns
    if (this.metadata) {
      Object.keys(this.metadata).forEach(key => {
        if (this.metadata![key] === null || this.metadata![key] === undefined) {
          delete this.metadata![key];
        }
      });
    }
  }

  // Soft delete method
  softDelete(userId?: string): void {
    this.isDeleted = true;
    this.deletedAt = new Date();
    if (userId) {
      this.updatedBy = userId;
    }
  }

  // Restore method
  restore(userId?: string): void {
    this.isDeleted = false;
    this.deletedAt = undefined;
    if (userId) {
      this.updatedBy = userId;
    }
  }

  // Check if record is soft deleted
  isSoftDeleted(): boolean {
    return this.isDeleted || !!this.deletedAt;
  }

  // Set audit information
  setAuditInfo(userId: string, isNew: boolean = false): void {
    if (isNew) {
      this.createdBy = userId;
      this.updatedBy = userId;
    } else {
      this.updatedBy = userId;
    }
  }

  // Set transaction context
  setTransactionContext(transactionId: string): void {
    this.lastTransactionId = transactionId;
  }

  // Add metadata
  addMetadata(key: string, value: unknown): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata[key] = value;
  }

  // Get metadata value
  getMetadata<T = unknown>(key: string): T | undefined {
    return this.metadata?.[key] as T;
  }

  // Remove metadata
  removeMetadata(key: string): void {
    if (this.metadata && key in this.metadata) {
      delete this.metadata[key];
    }
  }

  // Validate entity (to be overridden by child classes)
  validate(): string[] {
    const errors: string[] = [];
    
    // Basic validation
    if (!this.id) {
      errors.push('ID is required');
    }
    
    return errors;
  }

  // Convert to plain object (removes TypeORM metadata)
  toJSON(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    
    Object.keys(this).forEach(key => {
      const value = (this as Record<string, unknown>)[key];
      if (!key.startsWith('_') && typeof value !== 'function') {
        obj[key] = value;
      }
    });
    
    // Remove soft deleted fields if not deleted
    if (!this.isDeleted) {
      delete obj.isDeleted;
      delete obj.deletedAt;
    }
    
    return obj;
  }
}

// Base entity for HIPAA-compliant entities
export abstract class HIPAACompliantEntity extends BaseEntity {
  // Encryption status for PHI fields
  @Column({
    type: 'jsonb',
    nullable: true,
    default: {}
  })
  encryptionStatus?: Record<string, boolean>;

  // Access control
  @Column({
    type: 'jsonb',
    nullable: true,
    default: {}
  })
  accessControl?: {
    allowedRoles?: string[];
    deniedRoles?: string[];
    allowedUsers?: string[];
    deniedUsers?: string[];
    requiresBreakGlass?: boolean;
  };

  // Data retention
  @Column({
    type: 'timestamp with time zone',
    nullable: true
  })
  retentionDate?: Date;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true
  })
  retentionPolicy?: string;

  // Check if user has access
  hasAccess(userId: string, userRoles: string[]): boolean {
    if (!this.accessControl) {
      return true; // No restrictions
    }

    const { allowedUsers, deniedUsers, allowedRoles, deniedRoles } = this.accessControl;

    // Check denied users first
    if (deniedUsers?.includes(userId)) {
      return false;
    }

    // Check allowed users
    if (allowedUsers?.includes(userId)) {
      return true;
    }

    // Check denied roles
    if (deniedRoles?.some(role => userRoles.includes(role))) {
      return false;
    }

    // Check allowed roles
    if (allowedRoles?.length) {
      return allowedRoles.some(role => userRoles.includes(role));
    }

    return true;
  }

  // Mark field as encrypted
  markFieldEncrypted(fieldName: string): void {
    if (!this.encryptionStatus) {
      this.encryptionStatus = {};
    }
    this.encryptionStatus[fieldName] = true;
  }

  // Check if field is encrypted
  isFieldEncrypted(fieldName: string): boolean {
    return this.encryptionStatus?.[fieldName] === true;
  }

  // Set retention policy
  setRetentionPolicy(policy: string, retentionYears: number): void {
    this.retentionPolicy = policy;
    const date = new Date();
    date.setFullYear(date.getFullYear() + retentionYears);
    this.retentionDate = date;
  }
}