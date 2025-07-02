/**
 * OmniCare EMR Backend - User Entity
 * HIPAA-Compliant User Model with Enhanced Security
 */

import bcrypt from 'bcryptjs';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, BeforeInsert, BeforeUpdate } from 'typeorm';

import { UserRole, UserRoles } from '../types/auth.types';

@Entity('users')
@Index(['email'], { unique: true })
@Index(['username'], { unique: true })
@Index(['isActive', 'role'])
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password!: string;

  @Column({ type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ type: 'enum', enum: UserRoles })
  role!: UserRole;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  licenseNumber?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  npiNumber?: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  isMfaEnabled!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  mfaSecret?: string;

  @Column({ type: 'timestamp', nullable: true })
  passwordChangedAt?: Date;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  lastLoginIp?: string;

  @Column({ type: 'json', nullable: true })
  permissions?: string[];

  @Column({ type: 'json', nullable: true })
  scope?: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  patient?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clientId?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  // Virtual fields
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get isLocked(): boolean {
    return !!this.lockedUntil && this.lockedUntil > new Date();
  }

  // Methods
  async setPassword(password: string): Promise<void> {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(password, salt);
    this.passwordChangedAt = new Date();
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  incrementFailedLogin(): void {
    this.failedLoginAttempts++;
    
    // Lock account after 5 failed attempts for 30 minutes
    if (this.failedLoginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
  }

  resetFailedLogin(): void {
    this.failedLoginAttempts = 0;
    this.lockedUntil = undefined;
    this.lastLoginAt = new Date();
  }

  @BeforeInsert()
  @BeforeUpdate()
  sanitizeData(): void {
    // Ensure email is lowercase
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
    
    // Ensure username is lowercase
    if (this.username) {
      this.username = this.username.toLowerCase().trim();
    }
    
    // Trim names
    if (this.firstName) {
      this.firstName = this.firstName.trim();
    }
    if (this.lastName) {
      this.lastName = this.lastName.trim();
    }
  }

  // Role-based permission helpers
  hasPermission(permission: string): boolean {
    if (!this.permissions) return false;
    return this.permissions.includes(permission);
  }

  hasScope(scope: string): boolean {
    if (!this.scope) return false;
    return this.scope.includes(scope) || this.scope.includes('*');
  }

  isAdmin(): boolean {
    return this.role === UserRoles.SYSTEM_ADMINISTRATOR || 
           this.role === UserRoles.COMPLIANCE_OFFICER;
  }

  isClinicalStaff(): boolean {
    const clinicalRoles = [
      UserRoles.PHYSICIAN,
      UserRoles.NURSING_STAFF,
      UserRoles.MEDICAL_ASSISTANT,
      UserRoles.PHARMACIST,
      UserRoles.LAB_TECHNICIAN
    ];
    return clinicalRoles.includes(this.role);
  }

  toJSON(): Omit<this, 'password' | 'mfaSecret'> {
    const { password: _password, mfaSecret: _mfaSecret, ...rest } = this;
    return rest;
  }
}