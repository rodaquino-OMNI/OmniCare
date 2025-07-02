/**
 * OmniCare EMR Backend - User Service
 * HIPAA-Compliant User Management Service
 */

import { AppDataSource } from '../config/typeorm.config';
import { UserEntity } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { User, UserRole } from '../types/auth.types';
import logger from '../utils/logger';

export class UserService {
  private static instance: UserService;
  private userRepository?: UserRepository;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Initialize repository when DataSource is ready
   */
  private async ensureRepository(): Promise<UserRepository> {
    if (!this.userRepository) {
      if (!AppDataSource.isInitialized) {
        logger.warn('DataSource not initialized, using fallback');
        throw new Error('Database connection not initialized');
      }
      this.userRepository = new UserRepository(AppDataSource);
    }
    return this.userRepository;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      const repo = await this.ensureRepository();
      return await repo.findById(id);
    } catch (error) {
      logger.error('UserService.findById error:', error);
      // Return null instead of throwing during initialization
      return null;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const repo = await this.ensureRepository();
      return await repo.findByEmail(email);
    } catch (error) {
      logger.error('UserService.findByEmail error:', error);
      return null;
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    try {
      const repo = await this.ensureRepository();
      return await repo.findByUsername(username);
    } catch (error) {
      logger.error('UserService.findByUsername error:', error);
      return null;
    }
  }

  /**
   * Find user for authentication (includes password)
   */
  async findForAuthentication(identifier: string): Promise<UserEntity | null> {
    try {
      const repo = await this.ensureRepository();
      return await repo.findForAuthentication(identifier);
    } catch (error) {
      logger.error('UserService.findForAuthentication error:', error);
      return null;
    }
  }

  /**
   * Update login information
   */
  async updateLoginInfo(userId: string, ip: string, success: boolean): Promise<void> {
    try {
      const repo = await this.ensureRepository();
      await repo.updateLoginInfo(userId, ip, success);
    } catch (error) {
      logger.error('UserService.updateLoginInfo error:', error);
    }
  }

  /**
   * Get fallback mock user for development/testing
   */
  getFallbackUser(userId: string): User | null {
    const mockUsers: Record<string, User> = {
      'user-1': {
        id: 'user-1',
        username: 'admin@omnicare.com',
        email: 'admin@omnicare.com',
        firstName: 'System',
        lastName: 'Administrator',
        role: 'system_administrator' as UserRole,
        department: 'IT',
        isActive: true,
        isMfaEnabled: true,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'user-2': {
        id: 'user-2',
        username: 'doctor@omnicare.com',
        email: 'doctor@omnicare.com',
        firstName: 'Dr. Jane',
        lastName: 'Smith',
        role: 'physician' as UserRole,
        department: 'Cardiology',
        licenseNumber: 'MD123456',
        npiNumber: '1234567890',
        isActive: true,
        isMfaEnabled: true,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'user-3': {
        id: 'user-3',
        username: 'nurse@omnicare.com',
        email: 'nurse@omnicare.com',
        firstName: 'Sarah',
        lastName: 'Johnson',
        role: 'nursing_staff' as UserRole,
        department: 'Emergency',
        licenseNumber: 'RN789012',
        isActive: true,
        isMfaEnabled: false,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    return mockUsers[userId] || null;
  }
}

// Export singleton instance
export const userService = UserService.getInstance();