/**
 * OmniCare EMR - Password Policy Service
 * HIPAA-Compliant Password Management and Enforcement
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

import bcrypt from 'bcrypt';

import { PASSWORD_POLICY, AUTH_CONFIG } from '@/config/auth.config';
import { AuditService } from '@/services/audit.service';
import { User } from '@/types/auth.types';

export interface PasswordValidation {
  isValid: boolean;
  score: number; // Password strength score (0-100)
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface PasswordHistory {
  userId: string;
  passwordHash: string;
  createdAt: Date;
  isActive: boolean;
}

export class PasswordService extends EventEmitter {
  private auditService: AuditService;
  private passwordHistory: Map<string, PasswordHistory[]> = new Map();

  // Common password patterns and weak passwords
  private readonly COMMON_PASSWORDS = [
    'password', '123456', 'password123', 'admin', 'qwerty',
    'letmein', 'welcome', 'monkey', '1234567890', 'abc123',
    'Password1', 'password1', 'Password123', 'Welcome123'
  ];

  private readonly SEQUENTIAL_PATTERNS = [
    '123', '234', '345', '456', '567', '678', '789', '890',
    'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij',
    'qwe', 'wer', 'erty', 'rty', 'tyu', 'yui', 'uio', 'iop'
  ];

  private readonly KEYBOARD_PATTERNS = [
    'qwerty', 'asdf', 'zxcv', 'qaz', 'wsx', 'edc', 'rfv',
    'tgb', 'yhn', 'ujm', 'ik', 'ol', 'qwertyui', 'asdfgh'
  ];

  constructor(auditService: AuditService) {
    super();
    this.auditService = auditService;
  }

  /**
   * Validate password against policy and security requirements
   */
  async validatePassword(password: string, user?: User): Promise<PasswordValidation> {
    const validation: PasswordValidation = {
      isValid: true,
      score: 0,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check minimum length
    if (password.length < PASSWORD_POLICY.minLength) {
      validation.errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
      validation.isValid = false;
    } else {
      validation.score += Math.min(20, password.length * 2);
    }

    // Check character requirements
    if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
      validation.errors.push('Password must contain at least one uppercase letter');
      validation.isValid = false;
    } else if (/[A-Z]/.test(password)) {
      validation.score += 10;
    }

    if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
      validation.errors.push('Password must contain at least one lowercase letter');
      validation.isValid = false;
    } else if (/[a-z]/.test(password)) {
      validation.score += 10;
    }

    if (PASSWORD_POLICY.requireNumbers && !/\d/.test(password)) {
      validation.errors.push('Password must contain at least one number');
      validation.isValid = false;
    } else if (/\d/.test(password)) {
      validation.score += 10;
    }

    if (PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      validation.errors.push('Password must contain at least one special character');
      validation.isValid = false;
    } else if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      validation.score += 15;
    }

    // Check for common passwords
    if (this.isCommonPassword(password)) {
      validation.errors.push('Password is too common and easily guessable');
      validation.isValid = false;
      validation.score = Math.max(0, validation.score - 30);
    }

    // Check for sequential patterns
    if (this.hasSequentialPattern(password)) {
      validation.warnings.push('Password contains sequential characters which may be less secure');
      validation.score = Math.max(0, validation.score - 10);
    }

    // Check for keyboard patterns
    if (this.hasKeyboardPattern(password)) {
      validation.warnings.push('Password contains keyboard patterns which may be less secure');
      validation.score = Math.max(0, validation.score - 10);
    }

    // Check for repeated characters
    if (this.hasRepeatedCharacters(password)) {
      validation.warnings.push('Password contains repeated characters');
      validation.score = Math.max(0, validation.score - 5);
    }

    // Check for user information (if user provided)
    if (user && this.containsUserInfo(password, user)) {
      validation.errors.push('Password cannot contain personal information');
      validation.isValid = false;
      validation.score = Math.max(0, validation.score - 20);
    }

    // Check password history
    if (user && await this.isPasswordReused(password, user.id)) {
      validation.errors.push(`Password cannot be one of your last ${PASSWORD_POLICY.preventReuse} passwords`);
      validation.isValid = false;
    }

    // Check password age (if user provided)
    if (user && this.isPasswordExpired(user)) {
      validation.warnings.push(`Password expires in ${this.getDaysUntilExpiry(user)} days`);
    }

    // Add complexity bonus
    const complexity = this.calculateComplexity(password);
    validation.score += complexity;

    // Cap score at 100
    validation.score = Math.min(100, validation.score);

    // Generate suggestions
    validation.suggestions = this.generateSuggestions(password, validation);

    return validation;
  }

  /**
   * Hash password securely
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, AUTH_CONFIG.security.saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let password = '';
    let characterSet = '';

    // Ensure at least one character from each required set
    if (PASSWORD_POLICY.requireUppercase) {
      password += uppercase[crypto.randomInt(uppercase.length)];
      characterSet += uppercase;
    }
    
    if (PASSWORD_POLICY.requireLowercase) {
      password += lowercase[crypto.randomInt(lowercase.length)];
      characterSet += lowercase;
    }
    
    if (PASSWORD_POLICY.requireNumbers) {
      password += numbers[crypto.randomInt(numbers.length)];
      characterSet += numbers;
    }
    
    if (PASSWORD_POLICY.requireSpecialChars) {
      password += symbols[crypto.randomInt(symbols.length)];
      characterSet += symbols;
    }

    // Fill remaining length
    for (let i = password.length; i < length; i++) {
      password += characterSet[crypto.randomInt(characterSet.length)];
    }

    // Shuffle the password using cryptographically secure randomization
    const passwordArray = password.split('');
    for (let i = passwordArray.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
    }
    return passwordArray.join('');
  }

  /**
   * Add password to history
   */
  async addPasswordToHistory(userId: string, passwordHash: string): Promise<void> {
    const history = this.passwordHistory.get(userId) || [];
    
    // Mark previous passwords as inactive
    history.forEach(entry => entry.isActive = false);
    
    // Add new password
    history.push({
      userId,
      passwordHash,
      createdAt: new Date(),
      isActive: true
    });

    // Keep only the required number of historical passwords
    if (history.length > PASSWORD_POLICY.preventReuse) {
      history.splice(0, history.length - PASSWORD_POLICY.preventReuse);
    }

    this.passwordHistory.set(userId, history);

    // Log password change
    await this.auditService.logSecurityEvent({
      type: 'PASSWORD_CHANGE',
      userId,
      severity: 'MEDIUM',
      description: 'Password changed successfully',
      metadata: { passwordHistoryCount: history.length }
    });
  }

  /**
   * Check if password is expired
   */
  isPasswordExpired(user: User): boolean {
    if (!user.passwordChangedAt) {
      return true; // Force change if no change date
    }

    const daysSinceChange = this.getDaysSincePasswordChange(user);
    return daysSinceChange >= PASSWORD_POLICY.maxAgeInDays;
  }

  /**
   * Get days until password expires
   */
  getDaysUntilExpiry(user: User): number {
    if (!user.passwordChangedAt) {
      return 0;
    }

    const daysSinceChange = this.getDaysSincePasswordChange(user);
    return Math.max(0, PASSWORD_POLICY.maxAgeInDays - daysSinceChange);
  }

  /**
   * Check if account should be locked due to failed attempts
   */
  shouldLockAccount(failedAttempts: number): boolean {
    return failedAttempts >= PASSWORD_POLICY.lockoutThreshold;
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(): { token: string; expires: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    return { token, expires };
  }

  /**
   * Validate password reset token
   */
  validatePasswordResetToken(token: string, storedToken: string, expires: Date): boolean {
    // Use timing-safe comparison to prevent timing attacks
    const tokenBuffer = Buffer.from(token, 'hex');
    const storedTokenBuffer = Buffer.from(storedToken, 'hex');
    
    // Ensure both tokens are the same length
    if (tokenBuffer.length !== storedTokenBuffer.length) {
      return false;
    }
    
    const isTokenValid = crypto.timingSafeEqual(tokenBuffer, storedTokenBuffer);
    const isNotExpired = new Date() < expires;
    
    return isTokenValid && isNotExpired;
  }

  /**
   * Check if password is commonly used
   */
  private isCommonPassword(password: string): boolean {
    const lowerPassword = password.toLowerCase();
    return this.COMMON_PASSWORDS.some(common => 
      lowerPassword.includes(common.toLowerCase())
    );
  }

  /**
   * Check for sequential patterns
   */
  private hasSequentialPattern(password: string): boolean {
    const lowerPassword = password.toLowerCase();
    return this.SEQUENTIAL_PATTERNS.some(pattern => 
      lowerPassword.includes(pattern)
    );
  }

  /**
   * Check for keyboard patterns
   */
  private hasKeyboardPattern(password: string): boolean {
    const lowerPassword = password.toLowerCase();
    return this.KEYBOARD_PATTERNS.some(pattern => 
      lowerPassword.includes(pattern)
    );
  }

  /**
   * Check for repeated characters
   */
  private hasRepeatedCharacters(password: string): boolean {
    // Check for 3 or more consecutive identical characters
    return /(.)\1{2,}/.test(password);
  }

  /**
   * Check if password contains user information
   */
  private containsUserInfo(password: string, user: User): boolean {
    const lowerPassword = password.toLowerCase();
    const userInfo = [
      user.username?.toLowerCase(),
      user.firstName?.toLowerCase(),
      user.lastName?.toLowerCase(),
      user.email?.toLowerCase().split('@')[0]
    ].filter(Boolean);

    return userInfo.some(info => 
      info && (lowerPassword.includes(info) || info.includes(lowerPassword))
    );
  }

  /**
   * Check if password was recently used
   */
  private async isPasswordReused(password: string, userId: string): Promise<boolean> {
    const history = this.passwordHistory.get(userId) || [];
    
    for (const entry of history) {
      if (await this.verifyPassword(password, entry.passwordHash)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate password complexity score
   */
  private calculateComplexity(password: string): number {
    let complexity = 0;

    // Character set diversity
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    
    complexity += (hasLower ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNumbers ? 1 : 0) + (hasSpecial ? 1 : 0);
    complexity *= 5; // Up to 20 points for character diversity

    // Length bonus
    if (password.length > 12) complexity += 5;
    if (password.length > 16) complexity += 5;

    // Entropy calculation (simplified)
    const uniqueChars = new Set(password).size;
    complexity += uniqueChars;

    return Math.min(25, complexity); // Cap at 25 points
  }

  /**
   * Generate password improvement suggestions
   */
  private generateSuggestions(password: string, validation: PasswordValidation): string[] {
    const suggestions: string[] = [];

    if (validation.score < 50) {
      suggestions.push('Consider using a longer password with mixed character types');
    }

    if (password.length < 16) {
      suggestions.push('Use at least 16 characters for better security');
    }

    if (!/[A-Z]/.test(password)) {
      suggestions.push('Add uppercase letters');
    }

    if (!/[a-z]/.test(password)) {
      suggestions.push('Add lowercase letters');
    }

    if (!/\d/.test(password)) {
      suggestions.push('Add numbers');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      suggestions.push('Add special characters');
    }

    if (this.hasRepeatedCharacters(password)) {
      suggestions.push('Avoid repeating the same character consecutively');
    }

    if (validation.score < 70) {
      suggestions.push('Consider using a passphrase with random words');
      suggestions.push('Use a password manager to generate strong passwords');
    }

    return suggestions;
  }

  /**
   * Get days since password was last changed
   */
  private getDaysSincePasswordChange(user: User): number {
    if (!user.passwordChangedAt) {
      return Infinity;
    }

    const now = new Date();
    const changeDate = new Date(user.passwordChangedAt);
    const diffTime = Math.abs(now.getTime() - changeDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}