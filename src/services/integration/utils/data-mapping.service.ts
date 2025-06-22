/**
 * OmniCare EMR - Data Mapping Service
 * Handles data transformation, mapping, and normalization between different systems
 */

import logger from '@/utils/logger';

export interface MappingRule {
  id: string;
  name: string;
  description: string;
  sourceSystem: string;
  targetSystem: string;
  sourceField: string;
  targetField: string;
  transformationType: TransformationType;
  transformationConfig?: any;
  conditions?: MappingCondition[];
  isActive: boolean;
  priority: number;
  createdDate: Date;
  lastModified: Date;
  createdBy: string;
  version: string;
}

export enum TransformationType {
  DIRECT = 'direct',
  LOOKUP = 'lookup',
  CALCULATION = 'calculation',
  CONCATENATION = 'concatenation',
  SPLIT = 'split',
  FORMAT = 'format',
  CONDITIONAL = 'conditional',
  CUSTOM_FUNCTION = 'custom_function',
  REGEX = 'regex',
  TEMPLATE = 'template'
}

export interface MappingCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'regex' | 'exists' | 'not_exists';
  value: any;
}

export interface LookupTable {
  id: string;
  name: string;
  description: string;
  sourceSystem: string;
  targetSystem: string;
  mappings: LookupMapping[];
  defaultValue?: any;
  caseSensitive: boolean;
  isActive: boolean;
  lastUpdated: Date;
}

export interface LookupMapping {
  sourceValue: any;
  targetValue: any;
  metadata?: Record<string, any>;
}

export interface DataSchema {
  id: string;
  name: string;
  version: string;
  system: string;
  fields: SchemaField[];
  relationships?: SchemaRelationship[];
  validationRules?: ValidationRule[];
}

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'object' | 'array' | 'uuid';
  required: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  enumValues?: any[];
  defaultValue?: any;
  description?: string;
  format?: string;
  nested?: SchemaField[];
}

export interface SchemaRelationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  sourceField: string;
  targetSchema: string;
  targetField: string;
  description?: string;
}

export interface ValidationRule {
  field: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface MappingContext {
  sourceSystem: string;
  targetSystem: string;
  transactionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  options?: MappingOptions;
}

export interface MappingOptions {
  strictMode?: boolean;
  failOnError?: boolean;
  skipValidation?: boolean;
  preserveUnmappedFields?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  customFunctions?: Record<string, Function>;
}

export interface MappingResult {
  success: boolean;
  data?: any;
  errors: MappingError[];
  warnings: string[];
  stats: MappingStats;
  unmappedFields?: string[];
}

export interface MappingError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
  value?: any;
}

export interface MappingStats {
  totalFields: number;
  mappedFields: number;
  skippedFields: number;
  errorFields: number;
  executionTime: number;
  rulesApplied: number;
}

export class DataMappingService {
  private mappingRules: Map<string, MappingRule[]> = new Map();
  private lookupTables: Map<string, LookupTable> = new Map();
  private schemas: Map<string, DataSchema> = new Map();
  private customFunctions: Map<string, Function> = new Map();

  constructor() {
    this.initializeService();
  }

  /**
   * Initialize data mapping service
   */
  private async initializeService(): Promise<void> {
    logger.info('Initializing data mapping service');
    
    // TODO: Load mapping rules, lookup tables, and schemas from storage
    await this.loadMappingRules();
    await this.loadLookupTables();
    await this.loadSchemas();
    this.registerBuiltInFunctions();
  }

  /**
   * Transform data using mapping rules
   */
  async transformData(
    sourceData: any,
    context: MappingContext
  ): Promise<MappingResult> {
    const startTime = Date.now();
    const result: MappingResult = {
      success: true,
      errors: [],
      warnings: [],
      stats: {
        totalFields: 0,
        mappedFields: 0,
        skippedFields: 0,
        errorFields: 0,
        executionTime: 0,
        rulesApplied: 0
      },
      unmappedFields: []
    };

    try {
      logger.debug(`Transforming data from ${context.sourceSystem} to ${context.targetSystem}`);

      // Get mapping rules for this transformation
      const ruleKey = `${context.sourceSystem}->${context.targetSystem}`;
      const rules = this.mappingRules.get(ruleKey) || [];

      if (rules.length === 0) {
        throw new Error(`No mapping rules found for ${ruleKey}`);
      }

      // Apply transformations
      const transformedData = await this.applyMappingRules(sourceData, rules, context, result);

      // Validate transformed data if target schema exists
      if (this.schemas.has(context.targetSystem)) {
        const validationResult = await this.validateData(transformedData, context.targetSystem);
        result.errors.push(...validationResult.errors);
        result.warnings.push(...validationResult.warnings);
      }

      result.data = transformedData;
      result.success = result.errors.filter(e => e.severity === 'error').length === 0;
      result.stats.executionTime = Date.now() - startTime;

      logger.info(`Data transformation completed in ${result.stats.executionTime}ms`);
      return result;
    } catch (error) {
      logger.error('Data transformation failed:', error);
      result.success = false;
      result.errors.push({
        field: 'root',
        message: error instanceof Error ? error.message : 'Unknown transformation error',
        code: 'TRANSFORMATION_FAILED',
        severity: 'error'
      });
      result.stats.executionTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Apply mapping rules to transform data
   */
  private async applyMappingRules(
    sourceData: any,
    rules: MappingRule[],
    context: MappingContext,
    result: MappingResult
  ): Promise<any> {
    const transformedData: any = {};
    const processedFields = new Set<string>();

    // Sort rules by priority
    const sortedRules = rules.filter(r => r.isActive).sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      try {
        // Check conditions
        if (rule.conditions && !this.evaluateConditions(sourceData, rule.conditions)) {
          continue;
        }

        // Get source value
        const sourceValue = this.getNestedValue(sourceData, rule.sourceField);
        
        if (sourceValue === undefined && !rule.transformationConfig?.allowUndefined) {
          result.skippedFields++;
          continue;
        }

        // Apply transformation
        const transformedValue = await this.applyTransformation(
          sourceValue,
          rule,
          sourceData,
          context
        );

        // Set target value
        this.setNestedValue(transformedData, rule.targetField, transformedValue);
        
        processedFields.add(rule.sourceField);
        result.mappedFields++;
        result.rulesApplied++;

      } catch (error) {
        logger.error(`Error applying rule ${rule.id}:`, error);
        result.errors.push({
          field: rule.sourceField,
          message: `Rule application failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'RULE_APPLICATION_FAILED',
          severity: 'error'
        });
        result.errorFields++;
      }
    }

    // Handle unmapped fields if preservation is enabled
    if (context.options?.preserveUnmappedFields) {
      const unmappedFields = this.findUnmappedFields(sourceData, processedFields);
      unmappedFields.forEach(field => {
        const value = this.getNestedValue(sourceData, field);
        this.setNestedValue(transformedData, field, value);
      });
      result.unmappedFields = unmappedFields;
    }

    result.stats.totalFields = this.countFields(sourceData);
    
    return transformedData;
  }

  /**
   * Apply specific transformation type
   */
  private async applyTransformation(
    value: any,
    rule: MappingRule,
    sourceData: any,
    context: MappingContext
  ): Promise<any> {
    switch (rule.transformationType) {
      case TransformationType.DIRECT:
        return value;

      case TransformationType.LOOKUP:
        return this.applyLookupTransformation(value, rule.transformationConfig);

      case TransformationType.CALCULATION:
        return this.applyCalculation(value, rule.transformationConfig, sourceData);

      case TransformationType.CONCATENATION:
        return this.applyConcatenation(sourceData, rule.transformationConfig);

      case TransformationType.SPLIT:
        return this.applySplit(value, rule.transformationConfig);

      case TransformationType.FORMAT:
        return this.applyFormat(value, rule.transformationConfig);

      case TransformationType.CONDITIONAL:
        return this.applyConditional(value, rule.transformationConfig, sourceData);

      case TransformationType.CUSTOM_FUNCTION:
        return this.applyCustomFunction(value, rule.transformationConfig, sourceData, context);

      case TransformationType.REGEX:
        return this.applyRegex(value, rule.transformationConfig);

      case TransformationType.TEMPLATE:
        return this.applyTemplate(rule.transformationConfig.template, sourceData);

      default:
        throw new Error(`Unsupported transformation type: ${rule.transformationType}`);
    }
  }

  /**
   * Apply lookup transformation
   */
  private applyLookupTransformation(value: any, config: any): any {
    const lookupTable = this.lookupTables.get(config.tableId);
    if (!lookupTable) {
      throw new Error(`Lookup table not found: ${config.tableId}`);
    }

    const mapping = lookupTable.mappings.find(m => 
      lookupTable.caseSensitive 
        ? m.sourceValue === value 
        : String(m.sourceValue).toLowerCase() === String(value).toLowerCase()
    );

    return mapping ? mapping.targetValue : (lookupTable.defaultValue ?? value);
  }

  /**
   * Apply calculation transformation
   */
  private applyCalculation(value: any, config: any, sourceData: any): any {
    // TODO: Implement calculation engine (could use expression parser)
    const expression = config.expression;
    const variables = { value, ...sourceData };
    
    // Simple evaluation for demonstration
    if (expression === 'value * 2') {
      return Number(value) * 2;
    }
    
    return value;
  }

  /**
   * Apply concatenation transformation
   */
  private applyConcatenation(sourceData: any, config: any): string {
    const fields = config.fields || [];
    const separator = config.separator || '';
    
    const values = fields.map((field: string) => 
      this.getNestedValue(sourceData, field) || ''
    );
    
    return values.join(separator);
  }

  /**
   * Apply split transformation
   */
  private applySplit(value: any, config: any): any {
    if (typeof value !== 'string') return value;
    
    const separator = config.separator || ',';
    const index = config.index;
    
    const parts = value.split(separator);
    
    if (index !== undefined) {
      return parts[index] || '';
    }
    
    return parts;
  }

  /**
   * Apply format transformation
   */
  private applyFormat(value: any, config: any): any {
    const format = config.format;
    
    switch (format) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'date':
        return new Date(value).toISOString().split('T')[0];
      case 'datetime':
        return new Date(value).toISOString();
      case 'number':
        return Number(value);
      case 'string':
        return String(value);
      default:
        return value;
    }
  }

  /**
   * Apply conditional transformation
   */
  private applyConditional(value: any, config: any, sourceData: any): any {
    const conditions = config.conditions || [];
    
    for (const condition of conditions) {
      if (this.evaluateCondition(sourceData, condition.condition)) {
        return condition.value;
      }
    }
    
    return config.defaultValue ?? value;
  }

  /**
   * Apply custom function transformation
   */
  private async applyCustomFunction(
    value: any, 
    config: any, 
    sourceData: any, 
    context: MappingContext
  ): Promise<any> {
    const functionName = config.functionName;
    const customFunc = this.customFunctions.get(functionName) || 
                      context.options?.customFunctions?.[functionName];
    
    if (!customFunc) {
      throw new Error(`Custom function not found: ${functionName}`);
    }
    
    return customFunc(value, sourceData, config.parameters || {});
  }

  /**
   * Apply regex transformation
   */
  private applyRegex(value: any, config: any): any {
    if (typeof value !== 'string') return value;
    
    const pattern = new RegExp(config.pattern, config.flags || '');
    
    if (config.operation === 'replace') {
      return value.replace(pattern, config.replacement || '');
    } else if (config.operation === 'extract') {
      const match = value.match(pattern);
      return match ? (config.group ? match[config.group] : match[0]) : null;
    } else if (config.operation === 'test') {
      return pattern.test(value);
    }
    
    return value;
  }

  /**
   * Apply template transformation
   */
  private applyTemplate(template: string, sourceData: any): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, fieldPath) => {
      const value = this.getNestedValue(sourceData, fieldPath.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Evaluate mapping conditions
   */
  private evaluateConditions(data: any, conditions: MappingCondition[]): boolean {
    return conditions.every(condition => this.evaluateCondition(data, condition));
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(data: any, condition: MappingCondition): boolean {
    const fieldValue = this.getNestedValue(data, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'not_contains':
        return !String(fieldValue).includes(String(condition.value));
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'regex':
        return new RegExp(condition.value).test(String(fieldValue));
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;
      default:
        return false;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }

  /**
   * Count total fields in object
   */
  private countFields(obj: any, prefix = ''): number {
    let count = 0;
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const currentPath = prefix ? `${prefix}.${key}` : key;
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          count += this.countFields(obj[key], currentPath);
        } else {
          count++;
        }
      }
    }
    
    return count;
  }

  /**
   * Find unmapped fields
   */
  private findUnmappedFields(obj: any, processedFields: Set<string>, prefix = ''): string[] {
    const unmapped: string[] = [];
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const currentPath = prefix ? `${prefix}.${key}` : key;
        
        if (!processedFields.has(currentPath)) {
          if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            unmapped.push(...this.findUnmappedFields(obj[key], processedFields, currentPath));
          } else {
            unmapped.push(currentPath);
          }
        }
      }
    }
    
    return unmapped;
  }

  /**
   * Validate data against schema
   */
  private async validateData(data: any, schemaId: string): Promise<{ errors: MappingError[]; warnings: string[] }> {
    const errors: MappingError[] = [];
    const warnings: string[] = [];
    
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      warnings.push(`Schema not found for validation: ${schemaId}`);
      return { errors, warnings };
    }
    
    // TODO: Implement comprehensive schema validation
    
    return { errors, warnings };
  }

  /**
   * Register built-in transformation functions
   */
  private registerBuiltInFunctions(): void {
    this.customFunctions.set('generateId', () => {
      return `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    });

    this.customFunctions.set('formatPhone', (value: string) => {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }
      return value;
    });

    this.customFunctions.set('parseDate', (value: string) => {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    });

    logger.info('Built-in transformation functions registered');
  }

  /**
   * Load mapping rules from storage
   */
  private async loadMappingRules(): Promise<void> {
    // TODO: Load from database or configuration files
    logger.info('Mapping rules loaded');
  }

  /**
   * Load lookup tables from storage
   */
  private async loadLookupTables(): Promise<void> {
    // TODO: Load from database or configuration files
    logger.info('Lookup tables loaded');
  }

  /**
   * Load schemas from storage
   */
  private async loadSchemas(): Promise<void> {
    // TODO: Load from database or configuration files
    logger.info('Data schemas loaded');
  }

  /**
   * Add mapping rule
   */
  async addMappingRule(rule: Omit<MappingRule, 'id' | 'createdDate' | 'lastModified'>): Promise<MappingRule> {
    const newRule: MappingRule = {
      id: this.generateRuleId(),
      createdDate: new Date(),
      lastModified: new Date(),
      ...rule
    };

    const key = `${rule.sourceSystem}->${rule.targetSystem}`;
    const existingRules = this.mappingRules.get(key) || [];
    existingRules.push(newRule);
    this.mappingRules.set(key, existingRules);

    logger.info(`Mapping rule ${newRule.id} added for ${key}`);
    return newRule;
  }

  /**
   * Add lookup table
   */
  async addLookupTable(table: Omit<LookupTable, 'id' | 'lastUpdated'>): Promise<LookupTable> {
    const newTable: LookupTable = {
      id: this.generateTableId(),
      lastUpdated: new Date(),
      ...table
    };

    this.lookupTables.set(newTable.id, newTable);

    logger.info(`Lookup table ${newTable.id} added`);
    return newTable;
  }

  /**
   * Generate unique IDs
   */
  private generateRuleId(): string {
    return `rule_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateTableId(): string {
    return `table_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): { status: string; details: any } {
    return {
      status: 'UP',
      details: {
        mappingRulesCount: Array.from(this.mappingRules.values()).reduce((total, rules) => total + rules.length, 0),
        lookupTablesCount: this.lookupTables.size,
        schemasCount: this.schemas.size,
        customFunctionsCount: this.customFunctions.size
      }
    };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.mappingRules.clear();
    this.lookupTables.clear();
    this.schemas.clear();
    this.customFunctions.clear();
    logger.info('Data mapping service shut down');
  }
}

// Export singleton instance
export const dataMappingService = new DataMappingService();