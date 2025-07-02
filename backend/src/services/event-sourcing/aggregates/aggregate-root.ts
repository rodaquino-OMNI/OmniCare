/**
 * OmniCare EMR - Aggregate Root Base Class
 * Base implementation for all healthcare aggregates
 */

import { v4 as uuidv4 } from 'uuid';

import { DomainEvent, AggregateRoot, EventMetadata } from '../types/event-sourcing.types';

export abstract class BaseAggregateRoot implements AggregateRoot {
  public id: string;
  public version: number = 0;
  public uncommittedEvents: DomainEvent[] = [];
  
  protected constructor(id?: string) {
    this.id = id || uuidv4();
  }

  /**
   * Apply event to aggregate state
   */
  abstract applyEvent(event: DomainEvent): void;

  /**
   * Load aggregate from event history
   */
  loadFromHistory(events: DomainEvent[]): void {
    events.forEach(event => {
      this.applyEvent(event);
      this.version = Math.max(this.version, event.version || 0);
    });
  }

  /**
   * Add event to uncommitted events
   */
  protected addEvent(event: DomainEvent): void {
    event.version = this.version + 1;
    event.aggregateId = this.id;
    this.uncommittedEvents.push(event);
    this.applyEvent(event);
    this.version++;
  }

  /**
   * Get uncommitted events
   */
  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  /**
   * Mark events as committed
   */
  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  /**
   * Create snapshot of current state
   */
  abstract toSnapshot(): any;

  /**
   * Restore from snapshot
   */
  abstract fromSnapshot(snapshot: any): void;

  /**
   * Create event metadata with current context
   */
  protected createEventMetadata(
    userId: string,
    correlationId?: string,
    causationId?: string,
    additionalMetadata?: Record<string, any>
  ): EventMetadata {
    return {
      correlationId: correlationId || uuidv4(),
      causationId: causationId || uuidv4(),
      userId,
      timestamp: new Date().toISOString(),
      hipaaCompliant: true,
      dataClassification: 'PHI',
      retentionPeriod: '7_years',
      ...additionalMetadata
    };
  }

  /**
   * Validate aggregate invariants
   */
  protected abstract validateInvariants(): void;

  /**
   * Check if aggregate can handle event
   */
  protected canApplyEvent(event: DomainEvent): boolean {
    return event.aggregateId === this.id;
  }
}

/**
 * Healthcare-specific aggregate root with HIPAA compliance
 */
export abstract class HealthcareAggregateRoot extends BaseAggregateRoot {
  protected patientId?: string;
  protected encounterId?: string;
  protected hipaaAccessLogged: boolean = false;

  protected constructor(id?: string, patientId?: string) {
    super(id);
    this.patientId = patientId;
  }

  /**
   * Log HIPAA access for this aggregate
   */
  protected logHipaaAccess(userId: string, accessType: string, reason: string): void {
    if (!this.hipaaAccessLogged && this.patientId) {
      // This would trigger a separate HIPAA access event
      this.hipaaAccessLogged = true;
    }
  }

  /**
   * Validate HIPAA compliance for operations
   */
  protected validateHipaaCompliance(userId: string, operation: string): void {
    // Implement HIPAA validation logic
    if (!userId) {
      throw new Error('User ID required for HIPAA compliance');
    }
    
    // Add additional validation logic here
  }

  /**
   * Encrypt sensitive data in snapshots
   */
  protected encryptSensitiveData(data: any): any {
    // Implement encryption for PHI data
    return data; // Placeholder - would implement actual encryption
  }

  /**
   * Decrypt sensitive data from snapshots
   */
  protected decryptSensitiveData(data: any): any {
    // Implement decryption for PHI data
    return data; // Placeholder - would implement actual decryption
  }

  /**
   * Create healthcare-specific event metadata
   */
  protected createHealthcareEventMetadata(
    userId: string,
    operation: string,
    correlationId?: string,
    causationId?: string,
    additionalMetadata?: Record<string, any>
  ): EventMetadata {
    return this.createEventMetadata(userId, correlationId, causationId, {
      operation,
      patientId: this.patientId,
      encounterId: this.encounterId,
      complianceFlags: {
        hipaaLogged: true,
        auditRequired: true,
        phiAccessed: !!this.patientId
      },
      ...additionalMetadata
    });
  }
}

/**
 * Aggregate repository interface
 */
export interface AggregateRepository<T extends AggregateRoot> {
  getById(id: string): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * Base aggregate repository implementation
 */
export abstract class BaseAggregateRepository<T extends AggregateRoot> implements AggregateRepository<T> {
  protected abstract aggregateType: string;
  protected abstract createAggregate(id: string): T;

  constructor(protected eventStore: any) {}

  async getById(id: string): Promise<T | null> {
    try {
      // Try to get latest snapshot first
      const snapshot = await this.eventStore.getSnapshot(`${this.aggregateType}-${id}`);
      
      const aggregate = this.createAggregate(id);
      let fromVersion = 0;

      if (snapshot) {
        aggregate.fromSnapshot(snapshot.data);
        aggregate.version = snapshot.version;
        fromVersion = snapshot.version;
      }

      // Get events after snapshot
      const events = await this.eventStore.readAggregateEvents(
        id,
        this.aggregateType,
        fromVersion
      );

      if (events.length === 0 && !snapshot) {
        return null; // Aggregate doesn't exist
      }

      if (events.length > 0) {
        aggregate.loadFromHistory(events);
      }

      return aggregate;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load aggregate ${this.aggregateType}:${id}: ${errorMessage}`);
    }
  }

  async save(aggregate: T): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    
    if (uncommittedEvents.length === 0) {
      return; // Nothing to save
    }

    try {
      const streamId = `${this.aggregateType}-${aggregate.id}`;
      const expectedVersion = aggregate.version - uncommittedEvents.length;
      
      await this.eventStore.appendToStream(
        streamId,
        uncommittedEvents,
        expectedVersion
      );

      aggregate.markEventsAsCommitted();

      // Create snapshot if needed
      if (aggregate.version % 10 === 0) { // Every 10 events
        await this.createSnapshot(aggregate);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save aggregate ${this.aggregateType}:${aggregate.id}: ${errorMessage}`);
    }
  }

  async delete(id: string): Promise<void> {
    // Event sourcing doesn't really delete - we could add a "deleted" event
    // For now, this is a placeholder
    throw new Error('Aggregate deletion not implemented in event sourcing');
  }

  private async createSnapshot(aggregate: T): Promise<void> {
    const snapshot = {
      streamId: `${this.aggregateType}-${aggregate.id}`,
      version: aggregate.version,
      data: aggregate.toSnapshot(),
      metadata: {
        aggregateType: this.aggregateType,
        aggregateId: aggregate.id,
        snapshotVersion: 1
      }
    };

    await this.eventStore.saveSnapshot(snapshot);
  }
}