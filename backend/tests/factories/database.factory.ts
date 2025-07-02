/**
 * Database Test Data Factories
 * Generates test data for database entities
 */

import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export interface TestUser {
  id?: string;
  username: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface TestSession {
  id?: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  ip_address: string;
  user_agent: string;
  created_at?: Date;
  last_activity?: Date;
}

export interface TestAuditLog {
  id?: string;
  event_type: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
  created_at?: Date;
}

/**
 * User Factory
 */
export const userFactory = {
  build: (overrides: Partial<TestUser> = {}): TestUser => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const username = faker.internet.email({ firstName, lastName }).toLowerCase();
    
    return {
      id: uuidv4(),
      username,
      email: username,
      password_hash: bcrypt.hashSync('Test123!', 10),
      first_name: firstName,
      last_name: lastName,
      role: faker.helpers.arrayElement(['PROVIDER', 'NURSE', 'ADMIN', 'STAFF']),
      is_active: true,
      created_at: faker.date.recent(),
      updated_at: faker.date.recent(),
      ...overrides,
    };
  },

  buildList: (count: number, overrides: Partial<TestUser> = {}): TestUser[] => {
    return Array.from({ length: count }, () => userFactory.build(overrides));
  },

  // Specific user types
  buildAdmin: (overrides: Partial<TestUser> = {}): TestUser => {
    return userFactory.build({
      role: 'SYSTEM_ADMINISTRATOR',
      username: `admin-${faker.string.alphanumeric(6)}@omnicare.com`,
      email: `admin-${faker.string.alphanumeric(6)}@omnicare.com`,
      ...overrides,
    });
  },

  buildPhysician: (overrides: Partial<TestUser> = {}): TestUser => {
    return userFactory.build({
      role: 'PHYSICIAN',
      username: `dr-${faker.person.lastName().toLowerCase()}@omnicare.com`,
      email: `dr-${faker.person.lastName().toLowerCase()}@omnicare.com`,
      ...overrides,
    });
  },

  buildNurse: (overrides: Partial<TestUser> = {}): TestUser => {
    return userFactory.build({
      role: 'NURSE',
      username: `nurse-${faker.person.lastName().toLowerCase()}@omnicare.com`,
      email: `nurse-${faker.person.lastName().toLowerCase()}@omnicare.com`,
      ...overrides,
    });
  },
};

/**
 * Session Factory
 */
export const sessionFactory = {
  build: (userId: string, overrides: Partial<TestSession> = {}): TestSession => {
    return {
      id: uuidv4(),
      user_id: userId,
      token_hash: bcrypt.hashSync(`token-${uuidv4()}`, 10),
      expires_at: faker.date.future({ days: 1 }),
      ip_address: faker.internet.ipv4(),
      user_agent: faker.internet.userAgent(),
      created_at: new Date(),
      last_activity: new Date(),
      ...overrides,
    };
  },

  buildExpired: (userId: string, overrides: Partial<TestSession> = {}): TestSession => {
    return sessionFactory.build(userId, {
      expires_at: faker.date.past(),
      ...overrides,
    });
  },

  buildList: (userId: string, count: number, overrides: Partial<TestSession> = {}): TestSession[] => {
    return Array.from({ length: count }, () => sessionFactory.build(userId, overrides));
  },
};

/**
 * Audit Log Factory
 */
export const auditLogFactory = {
  build: (overrides: Partial<TestAuditLog> = {}): TestAuditLog => {
    return {
      id: uuidv4(),
      event_type: faker.helpers.arrayElement([
        'login_success',
        'login_failure',
        'logout',
        'patient_access',
        'patient_update',
        'security_alert',
        'permission_denied',
      ]),
      user_id: uuidv4(),
      ip_address: faker.internet.ipv4(),
      user_agent: faker.internet.userAgent(),
      details: {
        action: faker.helpers.arrayElement(['view', 'create', 'update', 'delete']),
        resource: faker.helpers.arrayElement(['patient', 'appointment', 'prescription']),
        timestamp: new Date().toISOString(),
      },
      created_at: faker.date.recent(),
      ...overrides,
    };
  },

  buildSecurityEvent: (overrides: Partial<TestAuditLog> = {}): TestAuditLog => {
    return auditLogFactory.build({
      event_type: faker.helpers.arrayElement([
        'unauthorized_access',
        'suspicious_activity',
        'brute_force_attempt',
        'session_hijack_attempt',
      ]),
      details: {
        severity: faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
        ...overrides.details,
      },
      ...overrides,
    });
  },

  buildPatientAccess: (userId: string, patientId: string, overrides: Partial<TestAuditLog> = {}): TestAuditLog => {
    return auditLogFactory.build({
      event_type: 'patient_access',
      user_id: userId,
      details: {
        patient_id: patientId,
        access_type: faker.helpers.arrayElement(['view', 'update']),
        phi_accessed: faker.helpers.arrayElements([
          'demographics',
          'medical_history',
          'medications',
          'lab_results',
        ]),
        ...overrides.details,
      },
      ...overrides,
    });
  },

  buildList: (count: number, overrides: Partial<TestAuditLog> = {}): TestAuditLog[] => {
    return Array.from({ length: count }, () => auditLogFactory.build(overrides));
  },
};

/**
 * OAuth Client Factory
 */
export const oauthClientFactory = {
  build: (overrides: Partial<any> = {}): any => {
    const clientName = faker.company.name();
    
    return {
      client_id: `client-${faker.string.alphanumeric(12)}`,
      client_secret: faker.string.alphanumeric(32),
      redirect_uris: [faker.internet.url()],
      allowed_scopes: faker.helpers.arrayElements([
        'patient/*.read',
        'patient/*.write',
        'user/*.read',
        'system/*.read',
        'openid',
        'profile',
        'launch',
      ]),
      client_name: clientName,
      is_active: true,
      created_at: faker.date.recent(),
      ...overrides,
    };
  },

  buildTestClient: (overrides: Partial<any> = {}): any => {
    return oauthClientFactory.build({
      client_id: `test-client-${faker.string.alphanumeric(6)}`,
      client_name: 'Test Client',
      redirect_uris: ['https://localhost:3000/callback'],
      ...overrides,
    });
  },
};

/**
 * Database Seeder
 * Seeds test database with realistic data
 */
export class DatabaseSeeder {
  static async seedUsers(client: any, count: number = 10): Promise<TestUser[]> {
    const users: TestUser[] = [];
    
    // Create specific role users
    users.push(userFactory.buildAdmin());
    users.push(userFactory.buildPhysician());
    users.push(userFactory.buildNurse());
    
    // Create random users
    users.push(...userFactory.buildList(count - 3));
    
    // Insert into database
    for (const user of users) {
      const query = `
        INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (username) DO NOTHING
        RETURNING *
      `;
      
      await client.query(query, [
        user.id,
        user.username,
        user.email,
        user.password_hash,
        user.first_name,
        user.last_name,
        user.role,
        user.is_active,
      ]);
    }
    
    return users;
  }

  static async seedSessions(client: any, users: TestUser[], sessionsPerUser: number = 2): Promise<TestSession[]> {
    const sessions: TestSession[] = [];
    
    for (const user of users) {
      if (user.id) {
        const userSessions = sessionFactory.buildList(user.id, sessionsPerUser);
        sessions.push(...userSessions);
        
        for (const session of userSessions) {
          const query = `
            INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
          `;
          
          await client.query(query, [
            session.id,
            session.user_id,
            session.token_hash,
            session.expires_at,
            session.ip_address,
            session.user_agent,
          ]);
        }
      }
    }
    
    return sessions;
  }

  static async seedAuditLogs(client: any, users: TestUser[], logsPerUser: number = 5): Promise<TestAuditLog[]> {
    const logs: TestAuditLog[] = [];
    
    for (const user of users) {
      if (user.id) {
        for (let i = 0; i < logsPerUser; i++) {
          const log = auditLogFactory.build({ user_id: user.id });
          logs.push(log);
          
          const query = `
            INSERT INTO audit.security_logs (id, event_type, user_id, ip_address, user_agent, details)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
          `;
          
          await client.query(query, [
            log.id,
            log.event_type,
            log.user_id,
            log.ip_address,
            log.user_agent,
            JSON.stringify(log.details),
          ]);
        }
      }
    }
    
    return logs;
  }

  static async seedAll(client: any): Promise<{
    users: TestUser[];
    sessions: TestSession[];
    auditLogs: TestAuditLog[];
  }> {
    const users = await this.seedUsers(client);
    const sessions = await this.seedSessions(client, users);
    const auditLogs = await this.seedAuditLogs(client, users);
    
    return { users, sessions, auditLogs };
  }
}