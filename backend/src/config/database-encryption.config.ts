/**
 * PostgreSQL Encryption at Rest Configuration
 * HIPAA-compliant database encryption settings
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { DataSource, DataSourceOptions } from 'typeorm';

interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keyPath: string;
  keyRotationDays: number;
  sslMode: 'require' | 'verify-ca' | 'verify-full';
  sslCertPath?: string;
  sslKeyPath?: string;
  sslCaPath?: string;
}

/**
 * Database encryption configuration
 */
export const ENCRYPTION_CONFIG: EncryptionConfig = {
  enabled: process.env.NODE_ENV === 'production' || process.env.DB_ENCRYPTION_ENABLED === 'true',
  algorithm: 'aes-256-gcm',
  keyPath: process.env.DB_ENCRYPTION_KEY_PATH || '/secure/keys/db-encryption.key',
  keyRotationDays: 90,
  sslMode: (process.env.DB_SSL_MODE as 'require' | 'verify-ca' | 'verify-full') || 'require',
  sslCertPath: process.env.DB_SSL_CERT_PATH,
  sslKeyPath: process.env.DB_SSL_KEY_PATH,
  sslCaPath: process.env.DB_SSL_CA_PATH,
};

/**
 * Generate or retrieve database encryption key
 */
export function getDatabaseEncryptionKey(): Buffer {
  const keyPath = ENCRYPTION_CONFIG.keyPath;
  
  try {
    // In production, key should be managed by a key management service
    if (process.env.NODE_ENV === 'production' && process.env.KMS_KEY_ID) {
      // TODO: Integrate with AWS KMS, Azure Key Vault, or similar
      return Buffer.from(process.env.DB_ENCRYPTION_KEY || '', 'base64');
    }
    
    // For development/testing, generate a key if it doesn't exist
    if (!fs.existsSync(keyPath)) {
      const dir = path.dirname(keyPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      
      const key = crypto.randomBytes(32);
      fs.writeFileSync(keyPath, key, { mode: 0o600 });
      return key;
    }
    
    return fs.readFileSync(keyPath);
  } catch (error) {
    throw new Error(`Failed to retrieve database encryption key: ${error}`);
  }
}

/**
 * Get SSL configuration for PostgreSQL
 */
export function getSSLConfig(): any {
  if (!ENCRYPTION_CONFIG.enabled) {
    return false;
  }
  
  const sslConfig: any = {
    rejectUnauthorized: ENCRYPTION_CONFIG.sslMode !== 'require',
  };
  
  if (ENCRYPTION_CONFIG.sslCertPath) {
    sslConfig.cert = fs.readFileSync(ENCRYPTION_CONFIG.sslCertPath);
  }
  
  if (ENCRYPTION_CONFIG.sslKeyPath) {
    sslConfig.key = fs.readFileSync(ENCRYPTION_CONFIG.sslKeyPath);
  }
  
  if (ENCRYPTION_CONFIG.sslCaPath) {
    sslConfig.ca = fs.readFileSync(ENCRYPTION_CONFIG.sslCaPath);
  }
  
  return sslConfig;
}

/**
 * Create encrypted database connection options
 */
export function createEncryptedDataSourceOptions(): Partial<DataSourceOptions> {
  const baseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/omnicare_fhir';
  const url = new URL(baseUrl);
  
  // Ensure SSL is enabled
  if (ENCRYPTION_CONFIG.enabled) {
    url.searchParams.set('sslmode', ENCRYPTION_CONFIG.sslMode);
  }
  
  return {
    type: 'postgres',
    url: url.toString(),
    ssl: getSSLConfig(),
    extra: {
      // Connection pool settings
      max: parseInt(process.env.DB_POOL_SIZE || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      
      // Security settings
      statement_timeout: 30000,
      query_timeout: 30000,
      
      // Enable row-level security
      options: '-c row_security=on',
    },
    
    // TypeORM-specific security settings
    logging: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
    logger: 'advanced-console',
    
    // Migrations settings
    migrations: ['dist/migrations/*.js'],
    migrationsRun: false,
    migrationsTransactionMode: 'all',
  };
}

/**
 * Encrypt sensitive data before storing
 */
export function encryptField(data: string, fieldName: string): string {
  if (!ENCRYPTION_CONFIG.enabled) {
    return data;
  }
  
  const key = getDatabaseEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = (cipher as any).getAuthTag();
  
  // Combine IV, auth tag, and encrypted data
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  return combined.toString('base64');
}

/**
 * Decrypt sensitive data after retrieving
 */
export function decryptField(encryptedData: string, fieldName: string): string {
  if (!ENCRYPTION_CONFIG.enabled) {
    return encryptedData;
  }
  
  try {
    const key = getDatabaseEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract IV, auth tag, and encrypted data
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(16, 32);
    const encrypted = combined.slice(32);
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, key, iv);
    (decipher as any).setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`Failed to decrypt ${fieldName}: ${error}`);
  }
}

/**
 * Setup database encryption
 */
export async function setupDatabaseEncryption(dataSource: DataSource): Promise<void> {
  if (!ENCRYPTION_CONFIG.enabled) {
    // Database encryption is disabled
    return;
  }
  
  try {
    // Enable pgcrypto extension for additional encryption functions
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    
    // Create audit table for encryption events
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS encryption_audit (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        table_name VARCHAR(100),
        field_name VARCHAR(100),
        user_id VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details JSONB
      )
    `);
    
    // Create function to log encryption events
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION log_encryption_event(
        p_event_type VARCHAR,
        p_table_name VARCHAR,
        p_field_name VARCHAR,
        p_user_id VARCHAR,
        p_details JSONB
      ) RETURNS VOID AS $$
      BEGIN
        INSERT INTO encryption_audit (event_type, table_name, field_name, user_id, details)
        VALUES (p_event_type, p_table_name, p_field_name, p_user_id, p_details);
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Database encryption setup completed
  } catch (error) {
    console.error('Failed to setup database encryption:', error);
    throw error;
  }
}

/**
 * Validate encryption configuration
 */
export function validateEncryptionConfig(): void {
  if (!ENCRYPTION_CONFIG.enabled) {
    return;
  }
  
  const errors: string[] = [];
  
  // Check for encryption key
  if (!process.env.DB_ENCRYPTION_KEY && !fs.existsSync(ENCRYPTION_CONFIG.keyPath)) {
    errors.push('Database encryption key not found');
  }
  
  // Check SSL configuration
  if (ENCRYPTION_CONFIG.sslMode !== 'require') {
    if (!ENCRYPTION_CONFIG.sslCaPath) {
      errors.push('SSL CA certificate path required for verify-ca or verify-full mode');
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Database encryption configuration errors: ${errors.join(', ')}`);
  }
}

/**
 * Encrypt sensitive columns decorator
 */
export function EncryptedColumn(target: any, propertyKey: string): void {
  const originalGetter = target[`get_${propertyKey}`];
  const originalSetter = target[`set_${propertyKey}`];
  
  Object.defineProperty(target, propertyKey, {
    get() {
      const encryptedValue = originalGetter ? originalGetter.call(this) : this[`_${propertyKey}`];
      return encryptedValue ? decryptField(encryptedValue, propertyKey) : encryptedValue;
    },
    set(value: string) {
      const encryptedValue = value ? encryptField(value, propertyKey) : value;
      if (originalSetter) {
        originalSetter.call(this, encryptedValue);
      } else {
        this[`_${propertyKey}`] = encryptedValue;
      }
    },
    enumerable: true,
    configurable: true,
  });
}

export default {
  ENCRYPTION_CONFIG,
  getDatabaseEncryptionKey,
  getSSLConfig,
  createEncryptedDataSourceOptions,
  encryptField,
  decryptField,
  setupDatabaseEncryption,
  validateEncryptionConfig,
  EncryptedColumn,
};