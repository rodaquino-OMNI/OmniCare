/**
 * OmniCare EMR Backend - User Repository
 * HIPAA-Compliant User Data Access Layer
 */

import { DataSource, Repository, FindOptionsWhere, Like, In } from 'typeorm';

import { UserEntity } from '../entities/user.entity';
import { auditService } from '../services/audit.service';
import { User, UserRole } from '../types/auth.types';
import logger from '../utils/logger';

export class UserRepository {
  private repository: Repository<UserEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(UserEntity);
  }

  /**
   * Find user by ID with audit logging
   */
  async findById(id: string, includePassword = false): Promise<User | null> {
    try {
      const queryBuilder = this.repository.createQueryBuilder('user');
      
      if (includePassword) {
        queryBuilder.addSelect('user.password');
      }
      
      const userEntity = await queryBuilder
        .where('user.id = :id', { id })
        .andWhere('user.deletedAt IS NULL')
        .getOne();

      if (!userEntity) {
        return null;
      }

      // Log PHI access
      await auditService.logUserAction(
        'system',
        'user_lookup',
        'UserRepository.findById',
        { userId: id },
        'internal',
        'system',
        true
      );

      return this.mapEntityToUser(userEntity);
    } catch (error) {
      logger.error('Failed to find user by ID:', error);
      throw error;
    }
  }

  /**
   * Find user by email with audit logging
   */
  async findByEmail(email: string, includePassword = false): Promise<User | null> {
    try {
      const queryBuilder = this.repository.createQueryBuilder('user');
      
      if (includePassword) {
        queryBuilder.addSelect('user.password');
      }
      
      const userEntity = await queryBuilder
        .where('user.email = :email', { email: email.toLowerCase() })
        .andWhere('user.deletedAt IS NULL')
        .getOne();

      if (!userEntity) {
        return null;
      }

      return this.mapEntityToUser(userEntity);
    } catch (error) {
      logger.error('Failed to find user by email:', error);
      throw error;
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string, includePassword = false): Promise<User | null> {
    try {
      const queryBuilder = this.repository.createQueryBuilder('user');
      
      if (includePassword) {
        queryBuilder.addSelect('user.password');
      }
      
      const userEntity = await queryBuilder
        .where('user.username = :username', { username: username.toLowerCase() })
        .andWhere('user.deletedAt IS NULL')
        .getOne();

      if (!userEntity) {
        return null;
      }

      return this.mapEntityToUser(userEntity);
    } catch (error) {
      logger.error('Failed to find user by username:', error);
      throw error;
    }
  }

  /**
   * Find active user for authentication
   */
  async findForAuthentication(identifier: string): Promise<UserEntity | null> {
    try {
      const queryBuilder = this.repository.createQueryBuilder('user')
        .addSelect('user.password')
        .addSelect('user.mfaSecret')
        .where('user.deletedAt IS NULL')
        .andWhere('user.isActive = :isActive', { isActive: true })
        .andWhere(
          '(user.email = :identifier OR user.username = :identifier)',
          { identifier: identifier.toLowerCase() }
        );

      return await queryBuilder.getOne();
    } catch (error) {
      logger.error('Failed to find user for authentication:', error);
      throw error;
    }
  }

  /**
   * Find users by role
   */
  async findByRole(role: UserRole): Promise<User[]> {
    try {
      const userEntities = await this.repository.find({
        where: {
          role,
          isActive: true,
          deletedAt: undefined
        }
      });

      return userEntities.map(entity => this.mapEntityToUser(entity));
    } catch (error) {
      logger.error('Failed to find users by role:', error);
      throw error;
    }
  }

  /**
   * Find users by department
   */
  async findByDepartment(department: string): Promise<User[]> {
    try {
      const userEntities = await this.repository.find({
        where: {
          department,
          isActive: true,
          deletedAt: undefined
        }
      });

      return userEntities.map(entity => this.mapEntityToUser(entity));
    } catch (error) {
      logger.error('Failed to find users by department:', error);
      throw error;
    }
  }

  /**
   * Search users with filters
   */
  async searchUsers(filters: {
    search?: string;
    role?: UserRole;
    department?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ users: User[]; total: number }> {
    try {
      const queryBuilder = this.repository.createQueryBuilder('user')
        .where('user.deletedAt IS NULL');

      if (filters.search) {
        queryBuilder.andWhere(
          '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
          { search: `%${filters.search}%` }
        );
      }

      if (filters.role) {
        queryBuilder.andWhere('user.role = :role', { role: filters.role });
      }

      if (filters.department) {
        queryBuilder.andWhere('user.department = :department', { department: filters.department });
      }

      if (filters.isActive !== undefined) {
        queryBuilder.andWhere('user.isActive = :isActive', { isActive: filters.isActive });
      }

      const [userEntities, total] = await queryBuilder
        .orderBy('user.lastName', 'ASC')
        .addOrderBy('user.firstName', 'ASC')
        .limit(filters.limit || 50)
        .offset(filters.offset || 0)
        .getManyAndCount();

      return {
        users: userEntities.map(entity => this.mapEntityToUser(entity)),
        total
      };
    } catch (error) {
      logger.error('Failed to search users:', error);
      throw error;
    }
  }

  /**
   * Create new user
   */
  async create(userData: Partial<UserEntity>): Promise<User> {
    try {
      const userEntity = this.repository.create(userData);
      const savedEntity = await this.repository.save(userEntity);

      // Log user creation
      await auditService.logUserAction(
        'system',
        'user_created',
        'UserRepository.create',
        { userId: savedEntity.id },
        'internal',
        'system',
        true
      );

      return this.mapEntityToUser(savedEntity);
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async update(id: string, updates: Partial<UserEntity>): Promise<User | null> {
    try {
      // Remove sensitive fields from updates
      const { password, mfaSecret, ...safeUpdates } = updates;

      await this.repository.update(
        { id, deletedAt: undefined },
        safeUpdates
      );

      const updatedUser = await this.findById(id);

      if (updatedUser) {
        // Log user update
        await auditService.logUserAction(
          'system',
          'user_updated',
          'UserRepository.update',
          { userId: id, updates: Object.keys(safeUpdates) },
          'internal',
          'system',
          true
        );
      }

      return updatedUser;
    } catch (error) {
      logger.error('Failed to update user:', error);
      throw error;
    }
  }

  /**
   * Update password
   */
  async updatePassword(id: string, hashedPassword: string): Promise<boolean> {
    try {
      const result = await this.repository.update(
        { id, deletedAt: undefined },
        { 
          password: hashedPassword,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: undefined
        }
      );

      if (result.affected && result.affected > 0) {
        // Log password change
        await auditService.logSecurityEvent({
          type: 'PASSWORD_CHANGE',
          userId: id,
          severity: 'LOW',
          description: 'User password changed'
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to update password:', error);
      throw error;
    }
  }

  /**
   * Update login information
   */
  async updateLoginInfo(id: string, ip: string, success: boolean): Promise<void> {
    try {
      const user = await this.repository.findOne({
        where: { id, deletedAt: undefined }
      });

      if (!user) return;

      if (success) {
        user.resetFailedLogin();
        user.lastLoginIp = ip;
        await this.repository.save(user);
      } else {
        user.incrementFailedLogin();
        await this.repository.save(user);

        if (user.isLocked) {
          await auditService.logSecurityEvent({
            type: 'ACCOUNT_LOCKED',
            userId: id,
            severity: 'MEDIUM',
            description: 'Account locked due to failed login attempts',
            metadata: { failedAttempts: user.failedLoginAttempts }
          });
        }
      }
    } catch (error) {
      logger.error('Failed to update login info:', error);
      throw error;
    }
  }

  /**
   * Soft delete user
   */
  async softDelete(id: string): Promise<boolean> {
    try {
      const result = await this.repository.update(
        { id, deletedAt: undefined },
        { 
          deletedAt: new Date(),
          isActive: false
        }
      );

      if (result.affected && result.affected > 0) {
        // Log user deletion
        await auditService.logUserAction(
          'system',
          'user_deleted',
          'UserRepository.softDelete',
          { userId: id },
          'internal',
          'system',
          true
        );

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to soft delete user:', error);
      throw error;
    }
  }

  /**
   * Map entity to User interface
   */
  private mapEntityToUser(entity: UserEntity): User {
    return {
      id: entity.id,
      username: entity.username,
      email: entity.email,
      firstName: entity.firstName,
      lastName: entity.lastName,
      role: entity.role,
      department: entity.department,
      licenseNumber: entity.licenseNumber,
      npiNumber: entity.npiNumber,
      isActive: entity.isActive,
      isMfaEnabled: entity.isMfaEnabled,
      passwordChangedAt: entity.passwordChangedAt,
      failedLoginAttempts: entity.failedLoginAttempts,
      lastLoginAt: entity.lastLoginAt,
      permissions: entity.permissions,
      scope: entity.scope,
      patient: entity.patient,
      clientId: entity.clientId,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }
}