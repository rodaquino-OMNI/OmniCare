/**
 * OmniCare EMR - Event Store Service
 * Core event sourcing infrastructure with PostgreSQL
 * HIPAA-compliant event storage and retrieval
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'events';

import { Pool, QueryResult } from 'pg';
import { v4 as uuidv4 } from 'uuid';

import { DomainEvent, EventMetadata, EventStore, EventStream, Snapshot } from './types/event-sourcing.types';

import { databaseService } from '@/services/database.service';
import logger from '@/utils/logger';

export interface EventStoreConfig {
  snapshotFrequency: number;
  encryptEvents: boolean;
  compressionEnabled: boolean;
  retentionDays: number;
  maxEventsPerStream: number;
}

export class EventStoreService extends EventEmitter implements EventStore {
  private pool: Pool;
  private config: EventStoreConfig;
  private encryptionKey: string;

  constructor(config?: Partial<EventStoreConfig>) {
    super();
    this.config = {
      snapshotFrequency: 10,
      encryptEvents: true,
      compressionEnabled: true,
      retentionDays: 2555, // 7 years for HIPAA compliance
      maxEventsPerStream: 10000,
      ...config
    };
    this.pool = databaseService.getPool();
    this.encryptionKey = process.env.EVENT_STORE_ENCRYPTION_KEY || 'default-key-change-in-production';
  }

  /**
   * Initialize event store schema
   */
  async initialize(): Promise<void> {
    try {
      await this.createEventStoreSchema();
      logger.info('Event store initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize event store', error);
      throw error;
    }
  }

  /**
   * Append events to stream
   */
  async appendToStream(
    streamId: string,
    events: DomainEvent[],
    expectedVersion?: number
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check current version if expected version provided
      if (expectedVersion !== undefined) {
        const currentVersion = await this.getCurrentVersion(streamId, client);
        if (currentVersion !== expectedVersion) {
          throw new Error(`Concurrency conflict: Expected version ${expectedVersion}, but current version is ${currentVersion}`);
        }
      }

      // Get current version
      const currentVersion = await this.getCurrentVersion(streamId, client);
      let version = currentVersion;

      // Append each event
      for (const event of events) {
        version++;
        const eventData = this.config.encryptEvents ? 
          await this.encryptEventData(event.data) : 
          JSON.stringify(event.data);

        const metadata: EventMetadata = {
          correlationId: event.metadata?.correlationId || uuidv4(),
          causationId: event.metadata?.causationId || uuidv4(),
          userId: event.metadata?.userId || 'system',
          timestamp: new Date().toISOString(),
          ...event.metadata
        };

        await client.query(`
          INSERT INTO event_store.events (
            event_id, stream_id, event_type, event_version,
            event_data, event_metadata, sequence_number,
            aggregate_type, aggregate_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          event.eventId || uuidv4(),
          streamId,
          event.eventType,
          version,
          eventData,
          JSON.stringify(metadata),
          version,
          event.aggregateType,
          event.aggregateId,
          new Date()
        ]);
      }

      // Check if snapshot needed
      if (version % this.config.snapshotFrequency === 0) {
        await this.createSnapshotIfNeeded(streamId, version, client);
      }

      await client.query('COMMIT');

      // Emit events for projections
      for (const event of events) {
        this.emit('eventAppended', {
          streamId,
          event,
          version: currentVersion + events.indexOf(event) + 1
        });
      }

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to append events to stream', { streamId, error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Read events from stream
   */
  async readStreamEvents(
    streamId: string,
    fromVersion?: number,
    toVersion?: number
  ): Promise<DomainEvent[]> {
    try {
      let query = `
        SELECT * FROM event_store.events 
        WHERE stream_id = $1
      `;
      const params: any[] = [streamId];

      if (fromVersion !== undefined) {
        params.push(fromVersion);
        query += ` AND event_version >= $${params.length}`;
      }

      if (toVersion !== undefined) {
        params.push(toVersion);
        query += ` AND event_version <= $${params.length}`;
      }

      query += ' ORDER BY event_version ASC';

      const result = await this.pool.query(query, params);
      
      const events: DomainEvent[] = [];
      for (const row of result.rows) {
        const eventData = this.config.encryptEvents ?
          await this.decryptEventData(row.event_data) :
          JSON.parse(row.event_data);

        events.push({
          eventId: row.event_id,
          eventType: row.event_type,
          aggregateId: row.aggregate_id,
          aggregateType: row.aggregate_type,
          data: eventData,
          metadata: JSON.parse(row.event_metadata),
          version: row.event_version,
          timestamp: row.created_at
        });
      }

      return events;
    } catch (error) {
      logger.error('Failed to read stream events', { streamId, error });
      throw error;
    }
  }

  /**
   * Read all events for aggregate
   */
  async readAggregateEvents(
    aggregateId: string,
    aggregateType: string,
    fromVersion?: number
  ): Promise<DomainEvent[]> {
    try {
      let query = `
        SELECT * FROM event_store.events 
        WHERE aggregate_id = $1 AND aggregate_type = $2
      `;
      const params: any[] = [aggregateId, aggregateType];

      if (fromVersion !== undefined) {
        params.push(fromVersion);
        query += ` AND event_version > $${params.length}`;
      }

      query += ' ORDER BY event_version ASC';

      const result = await this.pool.query(query, params);
      
      const events: DomainEvent[] = [];
      for (const row of result.rows) {
        const eventData = this.config.encryptEvents ?
          await this.decryptEventData(row.event_data) :
          JSON.parse(row.event_data);

        events.push({
          eventId: row.event_id,
          eventType: row.event_type,
          aggregateId: row.aggregate_id,
          aggregateType: row.aggregate_type,
          data: eventData,
          metadata: JSON.parse(row.event_metadata),
          version: row.event_version,
          timestamp: row.created_at
        });
      }

      return events;
    } catch (error) {
      logger.error('Failed to read aggregate events', { aggregateId, aggregateType, error });
      throw error;
    }
  }

  /**
   * Get latest snapshot for stream
   */
  async getSnapshot(streamId: string): Promise<Snapshot | null> {
    try {
      const result = await this.pool.query(`
        SELECT * FROM event_store.snapshots
        WHERE stream_id = $1
        ORDER BY version DESC
        LIMIT 1
      `, [streamId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const data = this.config.encryptEvents ?
        await this.decryptEventData(row.snapshot_data) :
        JSON.parse(row.snapshot_data);

      return {
        streamId: row.stream_id,
        version: row.version,
        data,
        metadata: JSON.parse(row.metadata),
        createdAt: row.created_at
      };
    } catch (error) {
      logger.error('Failed to get snapshot', { streamId, error });
      throw error;
    }
  }

  /**
   * Save snapshot
   */
  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    try {
      const data = this.config.encryptEvents ?
        await this.encryptEventData(snapshot.data) :
        JSON.stringify(snapshot.data);

      await this.pool.query(`
        INSERT INTO event_store.snapshots (
          snapshot_id, stream_id, version, snapshot_data,
          metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        uuidv4(),
        snapshot.streamId,
        snapshot.version,
        data,
        JSON.stringify(snapshot.metadata),
        new Date()
      ]);

      logger.debug('Snapshot saved', { streamId: snapshot.streamId, version: snapshot.version });
    } catch (error) {
      logger.error('Failed to save snapshot', { streamId: snapshot.streamId, error });
      throw error;
    }
  }

  /**
   * Get all streams
   */
  async getAllStreams(): Promise<EventStream[]> {
    try {
      const result = await this.pool.query(`
        SELECT DISTINCT stream_id, aggregate_type, aggregate_id,
               MAX(event_version) as version,
               COUNT(*) as event_count,
               MIN(created_at) as created_at,
               MAX(created_at) as updated_at
        FROM event_store.events
        GROUP BY stream_id, aggregate_type, aggregate_id
        ORDER BY updated_at DESC
      `);

      return result.rows.map(row => ({
        streamId: row.stream_id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        version: row.version,
        eventCount: parseInt(row.event_count),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      logger.error('Failed to get all streams', error);
      throw error;
    }
  }

  /**
   * Replay events from specific point
   */
  async replayEvents(
    fromTimestamp: Date,
    toTimestamp?: Date,
    eventTypes?: string[]
  ): Promise<AsyncIterableIterator<DomainEvent>> {
    const self = this;
    
    async function* eventGenerator(): AsyncIterableIterator<DomainEvent> {
      const batchSize = 100;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = `
          SELECT * FROM event_store.events
          WHERE created_at >= $1
        `;
        const params: any[] = [fromTimestamp];

        if (toTimestamp) {
          params.push(toTimestamp);
          query += ` AND created_at <= $${params.length}`;
        }

        if (eventTypes && eventTypes.length > 0) {
          params.push(eventTypes);
          query += ` AND event_type = ANY($${params.length})`;
        }

        query += ` ORDER BY created_at ASC, sequence_number ASC`;
        query += ` LIMIT ${batchSize} OFFSET ${offset}`;

        const result = await self.pool.query(query, params);
        
        if (result.rows.length === 0) {
          hasMore = false;
          break;
        }

        for (const row of result.rows) {
          const eventData = self.config.encryptEvents ?
            await self.decryptEventData(row.event_data) :
            JSON.parse(row.event_data);

          yield {
            eventId: row.event_id,
            eventType: row.event_type,
            aggregateId: row.aggregate_id,
            aggregateType: row.aggregate_type,
            data: eventData,
            metadata: JSON.parse(row.event_metadata),
            version: row.event_version,
            timestamp: row.created_at
          };
        }

        offset += batchSize;
        if (result.rows.length < batchSize) {
          hasMore = false;
        }
      }
    }

    return eventGenerator();
  }

  /**
   * Archive old events
   */
  async archiveOldEvents(beforeDate: Date): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Copy to archive table
      const archiveResult = await client.query(`
        INSERT INTO event_store.events_archive
        SELECT * FROM event_store.events
        WHERE created_at < $1
      `, [beforeDate]);

      const archivedCount = archiveResult.rowCount || 0;

      // Delete from main table
      await client.query(`
        DELETE FROM event_store.events
        WHERE created_at < $1
      `, [beforeDate]);

      await client.query('COMMIT');

      logger.info(`Archived ${archivedCount} events`);
      return archivedCount;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to archive events', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get current version of stream
   */
  private async getCurrentVersion(streamId: string, client?: any): Promise<number> {
    const queryClient = client || this.pool;
    const result = await queryClient.query(
      'SELECT MAX(event_version) as version FROM event_store.events WHERE stream_id = $1',
      [streamId]
    );
    return result.rows[0]?.version || 0;
  }

  /**
   * Create snapshot if needed
   */
  private async createSnapshotIfNeeded(
    streamId: string, 
    version: number,
    client: any
  ): Promise<void> {
    // This is a placeholder - actual snapshot creation would be handled by aggregate
    logger.debug('Snapshot point reached', { streamId, version });
  }

  /**
   * Encrypt event data
   */
  private async encryptEventData(data: any): Promise<string> {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted
    });
  }

  /**
   * Decrypt event data
   */
  private async decryptEventData(encryptedData: string): Promise<any> {
    const { iv, authTag, encrypted } = JSON.parse(encryptedData);
    const algorithm = 'aes-256-gcm';
    
    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(this.encryptionKey, 'hex'),
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Create event store schema
   */
  private async createEventStoreSchema(): Promise<void> {
    await this.pool.query(`
      CREATE SCHEMA IF NOT EXISTS event_store;
      
      CREATE TABLE IF NOT EXISTS event_store.events (
        event_id UUID PRIMARY KEY,
        stream_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(255) NOT NULL,
        event_version INTEGER NOT NULL,
        event_data TEXT NOT NULL,
        event_metadata JSONB NOT NULL,
        sequence_number BIGSERIAL,
        aggregate_type VARCHAR(255) NOT NULL,
        aggregate_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stream_id, event_version)
      );

      CREATE INDEX IF NOT EXISTS idx_events_stream_id ON event_store.events(stream_id);
      CREATE INDEX IF NOT EXISTS idx_events_aggregate ON event_store.events(aggregate_type, aggregate_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON event_store.events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_created_at ON event_store.events(created_at);
      CREATE INDEX IF NOT EXISTS idx_events_metadata ON event_store.events USING gin(event_metadata);

      CREATE TABLE IF NOT EXISTS event_store.snapshots (
        snapshot_id UUID PRIMARY KEY,
        stream_id VARCHAR(255) NOT NULL,
        version INTEGER NOT NULL,
        snapshot_data TEXT NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_stream ON event_store.snapshots(stream_id, version DESC);

      CREATE TABLE IF NOT EXISTS event_store.events_archive (
        LIKE event_store.events INCLUDING ALL
      );

      CREATE TABLE IF NOT EXISTS event_store.projections (
        projection_id VARCHAR(255) PRIMARY KEY,
        projection_name VARCHAR(255) NOT NULL,
        last_processed_sequence BIGINT NOT NULL DEFAULT 0,
        last_processed_at TIMESTAMP,
        state JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
}

// Export singleton instance
export const eventStoreService = new EventStoreService();