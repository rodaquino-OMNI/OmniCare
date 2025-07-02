/**
 * OmniCare EMR Backend - TypeORM Configuration
 * Configuration for TypeORM ORM integration
 */

import * as path from 'path';

import { DataSource, DataSourceOptions } from 'typeorm';

import config from '@/config';
import logger from '@/utils/logger';
import { 
  createEncryptedDataSourceOptions, 
  validateEncryptionConfig,
  setupDatabaseEncryption 
} from './database-encryption.config';

// Parse database URL for TypeORM
const parseDatabaseUrl = (url: string) => {
  try {
    const dbUrl = new URL(url);
    return {
      host: dbUrl.hostname,
      port: parseInt(dbUrl.port || '5432', 10),
      username: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.slice(1), // Remove leading slash
    };
  } catch (error) {
    logger.error('Failed to parse database URL:', error);
    throw new Error('Invalid database URL');
  }
};

const dbConfig = parseDatabaseUrl(config.database.url);

// Validate encryption configuration on startup
validateEncryptionConfig();

// Get encrypted connection options
const encryptedOptions = createEncryptedDataSourceOptions();

// TypeORM configuration with encryption
export const typeOrmConfig: DataSourceOptions = {
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
  synchronize: false, // Never use in production
  logging: config.server.env === 'development' ? ['query', 'error'] : ['error'],
  entities: [
    path.join(__dirname, '../entities/**/*.entity{.ts,.js}')
  ],
  migrations: [
    path.join(__dirname, '../migrations/**/*{.ts,.js}')
  ],
  subscribers: [
    path.join(__dirname, '../subscribers/**/*.subscriber{.ts,.js}')
  ],
  poolSize: config.database.connectionPoolSize,
  // Use encryption-enabled SSL configuration for PostgreSQL only
  ...(config.server.env === 'production' && encryptedOptions.ssl ? { ssl: encryptedOptions.ssl } : {}),
  // Enable query result caching
  cache: {
    type: 'redis',
    options: {
      url: config.redis.url
    },
    duration: 60000 // 1 minute default
  },
  // Merge extra options with encryption settings
  extra: {
    ...encryptedOptions.extra,
    // Timeout configurations
    connectionTimeoutMillis: 2000,
    query_timeout: 10000,
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 30000,
    // Connection pool settings
    max: config.database.connectionPoolSize,
    idleTimeoutMillis: 30000,
    // Performance settings
    application_name: 'omnicare-emr',
  }
};

// Create TypeORM DataSource
export const AppDataSource = new DataSource(typeOrmConfig);

// Initialize TypeORM connection
export const initializeTypeORM = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('TypeORM DataSource initialized successfully', {
        database: dbConfig.database,
        host: dbConfig.host,
        entities: AppDataSource.entityMetadatas.length,
        migrations: AppDataSource.migrations.length
      });

      // Setup database encryption
      await setupDatabaseEncryption(AppDataSource);
      logger.info('Database encryption setup completed');

      // Run pending migrations in production
      if (config.server.env === 'production') {
        logger.info('Running pending migrations...');
        const migrations = await AppDataSource.runMigrations();
        logger.info(`Executed ${migrations.length} migrations`);
      }
    }
  } catch (error) {
    logger.error('Failed to initialize TypeORM connection:', error);
    throw error;
  }
};

// Close TypeORM connection
export const closeTypeORM = async (): Promise<void> => {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info('TypeORM DataSource closed');
    }
  } catch (error) {
    logger.error('Error closing TypeORM connection:', error);
    throw error;
  }
};

// Transaction helper with checkpoint support
export interface TransactionOptions {
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  enableCheckpoints?: boolean;
}

export const runInTransaction = async <T>(
  work: (manager: any) => Promise<T>,
  options?: TransactionOptions
): Promise<T> => {
  const queryRunner = AppDataSource.createQueryRunner();
  
  // Start transaction with optional isolation level
  await queryRunner.connect();
  await queryRunner.startTransaction(options?.isolationLevel);
  
  try {
    // Execute work function
    const result = await work(queryRunner.manager);
    
    // Commit transaction
    await queryRunner.commitTransaction();
    return result;
  } catch (error) {
    // Rollback on error
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    // Release query runner
    await queryRunner.release();
  }
};

// Export configured DataSource for migrations
export default AppDataSource;