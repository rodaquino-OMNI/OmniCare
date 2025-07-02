/**
 * OmniCare EMR - CQRS Command Bus
 * Command handling infrastructure for event sourcing
 */

import { EventEmitter } from 'events';

import { v4 as uuidv4 } from 'uuid';

import { Command, CommandHandler, CommandMetadata } from '../types/event-sourcing.types';

import logger from '@/utils/logger';

export interface CommandBusConfig {
  enableValidation: boolean;
  enableLogging: boolean;
  timeoutMs: number;
  retryCount: number;
}

export class CommandBus extends EventEmitter {
  private handlers: Map<string, CommandHandler> = new Map();
  private middlewares: CommandMiddleware[] = [];
  private config: CommandBusConfig;

  constructor(config?: Partial<CommandBusConfig>) {
    super();
    this.config = {
      enableValidation: true,
      enableLogging: true,
      timeoutMs: 30000,
      retryCount: 3,
      ...config
    };
  }

  /**
   * Register command handler
   */
  registerHandler(handler: CommandHandler): void {
    if (this.handlers.has(handler.commandType)) {
      throw new Error(`Handler for command type ${handler.commandType} already registered`);
    }
    
    this.handlers.set(handler.commandType, handler);
    logger.debug(`Command handler registered`, { commandType: handler.commandType });
  }

  /**
   * Unregister command handler
   */
  unregisterHandler(commandType: string): void {
    this.handlers.delete(commandType);
    logger.debug(`Command handler unregistered`, { commandType });
  }

  /**
   * Add middleware
   */
  use(middleware: CommandMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Execute command
   */
  async execute(command: Command): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Validate command
      if (this.config.enableValidation) {
        this.validateCommand(command);
      }

      // Log command execution start
      if (this.config.enableLogging) {
        logger.info('Command execution started', {
          commandId: command.commandId,
          commandType: command.commandType,
          aggregateId: command.aggregateId
        });
      }

      // Get handler
      const handler = this.handlers.get(command.commandType);
      if (!handler) {
        throw new Error(`No handler registered for command type: ${command.commandType}`);
      }

      // Execute middlewares
      let context: CommandContext = {
        command,
        handler,
        metadata: {
          executionId: uuidv4(),
          startTime,
          retryCount: 0
        }
      };

      for (const middleware of this.middlewares) {
        context = await middleware.execute(context);
      }

      // Execute handler with timeout
      await this.executeWithTimeout(handler, context.command);

      // Emit success event
      this.emit('commandExecuted', {
        command,
        duration: Date.now() - startTime,
        success: true
      });

      if (this.config.enableLogging) {
        logger.info('Command executed successfully', {
          commandId: command.commandId,
          commandType: command.commandType,
          duration: Date.now() - startTime
        });
      }

    } catch (error) {
      // Emit failure event
      this.emit('commandFailed', {
        command,
        error,
        duration: Date.now() - startTime
      });

      if (this.config.enableLogging) {
        logger.error('Command execution failed', {
          commandId: command.commandId,
          commandType: command.commandType,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        });
      }

      throw error;
    }
  }

  /**
   * Execute command with retry logic
   */
  async executeWithRetry(command: Command): Promise<void> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      try {
        await this.execute(command);
        return; // Success
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryCount && this.isRetryableError(error)) {
          logger.warn(`Command execution failed, retrying (${attempt + 1}/${this.config.retryCount})`, {
            commandId: command.commandId,
            error: error instanceof Error ? error.message : String(error)
          });
          
          // Exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw lastError!;
  }

  /**
   * Validate command structure
   */
  private validateCommand(command: Command): void {
    if (!command.commandId) {
      throw new Error('Command must have commandId');
    }
    
    if (!command.commandType) {
      throw new Error('Command must have commandType');
    }
    
    if (!command.aggregateId) {
      throw new Error('Command must have aggregateId');
    }
    
    if (!command.data) {
      throw new Error('Command must have data');
    }
  }

  /**
   * Execute handler with timeout
   */
  private async executeWithTimeout(handler: CommandHandler, command: Command): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command execution timeout: ${command.commandType}`));
      }, this.config.timeoutMs);

      handler.handle(command)
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Define retryable error types
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'CONCURRENCY_ERROR'
    ];
    
    return retryableErrors.some(errorType => 
      error.message?.includes(errorType) || error.code === errorType
    );
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all registered handlers
   */
  getHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all handlers and middlewares
   */
  clear(): void {
    this.handlers.clear();
    this.middlewares = [];
    this.removeAllListeners();
  }
}

/**
 * Command context for middleware
 */
export interface CommandContext {
  command: Command;
  handler: CommandHandler;
  metadata: {
    executionId: string;
    startTime: number;
    retryCount: number;
    [key: string]: any;
  };
}

/**
 * Command middleware interface
 */
export interface CommandMiddleware {
  execute(context: CommandContext): Promise<CommandContext>;
}

/**
 * Validation middleware
 */
export class ValidationMiddleware implements CommandMiddleware {
  async execute(context: CommandContext): Promise<CommandContext> {
    const { command } = context;
    
    // Validate command metadata
    if (!command.metadata?.userId) {
      throw new Error('Command must have userId in metadata');
    }
    
    if (!command.metadata?.correlationId) {
      command.metadata.correlationId = uuidv4();
    }
    
    if (!command.metadata?.timestamp) {
      command.metadata.timestamp = new Date().toISOString();
    }
    
    return context;
  }
}

/**
 * Audit middleware
 */
export class AuditMiddleware implements CommandMiddleware {
  constructor(private auditService: any) {}

  async execute(context: CommandContext): Promise<CommandContext> {
    const { command } = context;
    
    // Log command for audit
    await this.auditService.logUserAction(
      command.metadata?.userId || 'system',
      `command_${command.commandType.toLowerCase()}`,
      'command',
      command.commandId,
      command.metadata?.ipAddress || '0.0.0.0',
      command.metadata?.userAgent || 'system',
      true,
      undefined,
      {
        commandType: command.commandType,
        aggregateId: command.aggregateId,
        executionId: context.metadata.executionId
      }
    );
    
    return context;
  }
}

/**
 * Authorization middleware
 */
export class AuthorizationMiddleware implements CommandMiddleware {
  constructor(private permissions: Map<string, string[]>) {}

  async execute(context: CommandContext): Promise<CommandContext> {
    const { command } = context;
    const requiredPermissions = this.permissions.get(command.commandType);
    
    if (requiredPermissions) {
      const userPermissions = command.metadata?.userPermissions || [];
      const hasPermission = requiredPermissions.some(permission => 
        userPermissions.includes(permission)
      );
      
      if (!hasPermission) {
        throw new Error(`Insufficient permissions for command: ${command.commandType}`);
      }
    }
    
    return context;
  }
}

/**
 * Create healthcare command
 */
export function createHealthcareCommand(
  commandType: string,
  aggregateId: string,
  data: any,
  userId: string,
  correlationId?: string,
  additionalMetadata?: Record<string, any>
): Command {
  return {
    commandId: uuidv4(),
    commandType,
    aggregateId,
    data,
    metadata: {
      correlationId: correlationId || uuidv4(),
      userId,
      timestamp: new Date().toISOString(),
      hipaaCompliant: true,
      dataClassification: 'PHI',
      ...additionalMetadata
    }
  };
}

// Export singleton command bus
export const commandBus = new CommandBus();