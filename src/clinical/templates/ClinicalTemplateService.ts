/**
 * Clinical Template Service
 * OmniCare EMR - Clinical Documentation Templates Management
 */

import {
  ClinicalTemplate,
  ClinicalTemplateType,
  TemplateCategory,
  TemplateInstance,
  TemplateInstanceStatus,
  TemplateSearchCriteria,
  TemplateUsageStats,
  ValidationError,
  TemplateAccessControl,
  TemplateImportExport,
  TemplateRegistry,
  ValidationResult,
  TemplateAmendment,
  FieldChange,
  ClinicalFormBuilder,
  TemplateBuilderConfig,
  SmartFormCapabilities
} from './types';

export class ClinicalTemplateService implements TemplateRegistry {
  private templates: Map<string, ClinicalTemplate> = new Map();
  private templateInstances: Map<string, TemplateInstance> = new Map();
  private usageStats: Map<string, TemplateUsageStats> = new Map();
  private accessControls: Map<string, TemplateAccessControl> = new Map();
  private formBuilder: ClinicalFormBuilder;

  constructor() {
    this.formBuilder = new DefaultFormBuilder();
    this.initializeDefaultTemplates();
  }

  /**
   * TEMPLATE MANAGEMENT
   */

  async searchTemplates(criteria: TemplateSearchCriteria): Promise<ClinicalTemplate[]> {
    const templates = Array.from(this.templates.values());
    
    return templates.filter(template => {
      if (criteria.type && template.type !== criteria.type) return false;
      if (criteria.category && template.category !== criteria.category) return false;
      if (criteria.specialty && template.specialty !== criteria.specialty) return false;
      if (criteria.isActive !== undefined && template.isActive !== criteria.isActive) return false;
      
      if (criteria.keywords && criteria.keywords.length > 0) {
        const templateText = `${template.name} ${template.description} ${template.metadata.tags.join(' ')}`.toLowerCase();
        const hasKeyword = criteria.keywords.some(keyword => 
          templateText.includes(keyword.toLowerCase())
        );
        if (!hasKeyword) return false;
      }

      if (criteria.patientAge && template.metadata.ageRange) {
        const age = criteria.patientAge;
        const ageRange = template.metadata.ageRange;
        if (ageRange.min && age < ageRange.min) return false;
        if (ageRange.max && age > ageRange.max) return false;
      }

      if (criteria.patientGender && template.metadata.gender && 
          template.metadata.gender !== 'any' && 
          template.metadata.gender !== criteria.patientGender) {
        return false;
      }

      if (criteria.clinicalContext && criteria.clinicalContext.length > 0) {
        const hasContext = criteria.clinicalContext.some(context =>
          template.metadata.clinicalContext.includes(context)
        );
        if (!hasContext) return false;
      }

      if (criteria.createdAfter && template.createdDate < criteria.createdAfter) return false;
      if (criteria.createdBefore && template.createdDate > criteria.createdBefore) return false;
      if (criteria.createdBy && template.createdBy !== criteria.createdBy) return false;

      return true;
    });
  }

  async getTemplate(id: string): Promise<ClinicalTemplate | null> {
    return this.templates.get(id) || null;
  }

  async createTemplate(template: ClinicalTemplate): Promise<string> {
    const id = this.generateId();
    const newTemplate: ClinicalTemplate = {
      ...template,
      id,
      createdDate: new Date(),
      lastModifiedDate: new Date(),
      version: '1.0.0'
    };

    // Validate template
    const validation = await this.validateTemplate(newTemplate);
    if (!validation.isValid) {
      throw new Error(`Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.templates.set(id, newTemplate);
    
    // Initialize usage stats
    this.usageStats.set(id, {
      templateId: id,
      usageCount: 0,
      lastUsed: new Date(),
      averageCompletionTime: 0,
      completionRate: 0,
      errorRate: 0,
      userFeedback: []
    });

    await this.logActivity('template_created', id, template.createdBy);
    return id;
  }

  async updateTemplate(id: string, updates: Partial<ClinicalTemplate>): Promise<void> {
    const existingTemplate = this.templates.get(id);
    if (!existingTemplate) {
      throw new Error('Template not found');
    }

    const updatedTemplate: ClinicalTemplate = {
      ...existingTemplate,
      ...updates,
      lastModifiedDate: new Date(),
      version: this.incrementVersion(existingTemplate.version)
    };

    // Validate updated template
    const validation = await this.validateTemplate(updatedTemplate);
    if (!validation.isValid) {
      throw new Error(`Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.templates.set(id, updatedTemplate);
    await this.logActivity('template_updated', id, updates.lastModifiedBy || 'system');
  }

  async deleteTemplate(id: string): Promise<void> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error('Template not found');
    }

    // Check if template has active instances
    const activeInstances = await this.getActiveTemplateInstances(id);
    if (activeInstances.length > 0) {
      throw new Error('Cannot delete template with active instances');
    }

    this.templates.delete(id);
    this.usageStats.delete(id);
    this.accessControls.delete(id);
    
    await this.logActivity('template_deleted', id, 'system');
  }

  async duplicateTemplate(id: string, newName: string): Promise<string> {
    const originalTemplate = this.templates.get(id);
    if (!originalTemplate) {
      throw new Error('Template not found');
    }

    const duplicatedTemplate: ClinicalTemplate = {
      ...originalTemplate,
      id: this.generateId(),
      name: newName,
      createdDate: new Date(),
      lastModifiedDate: new Date(),
      version: '1.0.0',
      isDefault: false
    };

    return await this.createTemplate(duplicatedTemplate);
  }

  async getTemplateVersions(id: string): Promise<ClinicalTemplate[]> {
    // In a real implementation, this would fetch version history from a database
    const currentTemplate = this.templates.get(id);
    return currentTemplate ? [currentTemplate] : [];
  }

  async publishTemplate(id: string): Promise<void> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error('Template not found');
    }

    template.isActive = true;
    template.lastModifiedDate = new Date();
    this.templates.set(id, template);
    
    await this.logActivity('template_published', id, 'system');
  }

  async retireTemplate(id: string): Promise<void> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error('Template not found');
    }

    template.isActive = false;
    template.lastModifiedDate = new Date();
    this.templates.set(id, template);
    
    await this.logActivity('template_retired', id, 'system');
  }

  /**
   * TEMPLATE INSTANCE MANAGEMENT
   */

  async createTemplateInstance(
    templateId: string,
    patientId: string,
    encounterId: string | undefined,
    createdBy: string
  ): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    if (!template.isActive) {
      throw new Error('Cannot create instance from inactive template');
    }

    const instanceId = this.generateId();
    const instance: TemplateInstance = {
      id: instanceId,
      templateId,
      patientId,
      encounterId,
      createdBy,
      createdDate: new Date(),
      lastModifiedBy: createdBy,
      lastModifiedDate: new Date(),
      status: 'draft',
      data: {},
      validationErrors: [],
      isSigned: false,
      isLocked: false,
      version: '1.0.0',
      amendments: []
    };

    this.templateInstances.set(instanceId, instance);
    
    // Update usage stats
    const stats = this.usageStats.get(templateId);
    if (stats) {
      stats.usageCount++;
      stats.lastUsed = new Date();
    }

    await this.logActivity('instance_created', instanceId, createdBy);
    return instanceId;
  }

  async updateTemplateInstance(
    instanceId: string,
    data: Record<string, any>,
    updatedBy: string
  ): Promise<void> {
    const instance = this.templateInstances.get(instanceId);
    if (!instance) {
      throw new Error('Template instance not found');
    }

    if (instance.isLocked) {
      throw new Error('Cannot update locked template instance');
    }

    // Track changes for amendments
    const changes: FieldChange[] = this.detectChanges(instance.data, data);
    
    instance.data = { ...instance.data, ...data };
    instance.lastModifiedBy = updatedBy;
    instance.lastModifiedDate = new Date();
    
    // Validate instance data
    const template = this.templates.get(instance.templateId);
    if (template) {
      instance.validationErrors = await this.validateInstanceData(template, instance.data);
    }

    // Update status based on completion
    instance.status = this.determineInstanceStatus(instance);

    this.templateInstances.set(instanceId, instance);
    await this.logActivity('instance_updated', instanceId, updatedBy);
  }

  async signTemplateInstance(instanceId: string, signedBy: string): Promise<void> {
    const instance = this.templateInstances.get(instanceId);
    if (!instance) {
      throw new Error('Template instance not found');
    }

    if (instance.validationErrors.some(error => error.severity === 'error')) {
      throw new Error('Cannot sign template instance with validation errors');
    }

    instance.isSigned = true;
    instance.signedBy = signedBy;
    instance.signedDate = new Date();
    instance.status = 'signed';
    instance.isLocked = true;

    this.templateInstances.set(instanceId, instance);
    await this.logActivity('instance_signed', instanceId, signedBy);
  }

  async amendTemplateInstance(
    instanceId: string,
    amendments: Record<string, any>,
    amendedBy: string,
    reason: string
  ): Promise<string> {
    const originalInstance = this.templateInstances.get(instanceId);
    if (!originalInstance) {
      throw new Error('Template instance not found');
    }

    if (!originalInstance.isSigned) {
      throw new Error('Can only amend signed template instances');
    }

    // Create new amended instance
    const amendedInstanceId = this.generateId();
    const changes: FieldChange[] = this.detectChanges(originalInstance.data, amendments);
    
    const amendment: TemplateAmendment = {
      id: this.generateId(),
      amendedBy,
      amendedDate: new Date(),
      reason,
      changes,
      isSignificant: this.isSignificantAmendment(changes)
    };

    const amendedInstance: TemplateInstance = {
      ...originalInstance,
      id: amendedInstanceId,
      data: { ...originalInstance.data, ...amendments },
      lastModifiedBy: amendedBy,
      lastModifiedDate: new Date(),
      status: 'amended',
      isSigned: false,
      signedBy: undefined,
      signedDate: undefined,
      isLocked: false,
      parentInstanceId: instanceId,
      amendments: [amendment]
    };

    this.templateInstances.set(amendedInstanceId, amendedInstance);
    await this.logActivity('instance_amended', amendedInstanceId, amendedBy);
    
    return amendedInstanceId;
  }

  async getTemplateInstance(instanceId: string): Promise<TemplateInstance | null> {
    return this.templateInstances.get(instanceId) || null;
  }

  async getPatientTemplateInstances(patientId: string): Promise<TemplateInstance[]> {
    return Array.from(this.templateInstances.values())
      .filter(instance => instance.patientId === patientId);
  }

  async getEncounterTemplateInstances(encounterId: string): Promise<TemplateInstance[]> {
    return Array.from(this.templateInstances.values())
      .filter(instance => instance.encounterId === encounterId);
  }

  /**
   * TEMPLATE VALIDATION
   */

  async validateTemplate(template: ClinicalTemplate): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Basic validation
    if (!template.name || template.name.trim().length === 0) {
      errors.push({
        fieldId: 'name',
        message: 'Template name is required',
        severity: 'error'
      });
    }

    if (!template.sections || template.sections.length === 0) {
      errors.push({
        fieldId: 'sections',
        message: 'Template must have at least one section',
        severity: 'error'
      });
    }

    // Section validation
    template.sections?.forEach((section, sectionIndex) => {
      if (!section.title || section.title.trim().length === 0) {
        errors.push({
          fieldId: `sections[${sectionIndex}].title`,
          message: 'Section title is required',
          severity: 'error'
        });
      }

      if (!section.fields || section.fields.length === 0) {
        warnings.push({
          fieldId: `sections[${sectionIndex}].fields`,
          message: 'Section has no fields',
          severity: 'warning'
        });
      }

      // Field validation
      section.fields?.forEach((field, fieldIndex) => {
        if (!field.name || field.name.trim().length === 0) {
          errors.push({
            fieldId: `sections[${sectionIndex}].fields[${fieldIndex}].name`,
            message: 'Field name is required',
            severity: 'error'
          });
        }

        if (!field.label || field.label.trim().length === 0) {
          errors.push({
            fieldId: `sections[${sectionIndex}].fields[${fieldIndex}].label`,
            message: 'Field label is required',
            severity: 'error'
          });
        }

        // Validate field options for select/radio fields
        if (['select', 'multiselect', 'radio'].includes(field.type)) {
          if (!field.options || field.options.length === 0) {
            errors.push({
              fieldId: `sections[${sectionIndex}].fields[${fieldIndex}].options`,
              message: 'Options are required for select/radio fields',
              severity: 'error'
            });
          }
        }
      });
    });

    // Validation rules
    template.validationRules?.forEach((rule, ruleIndex) => {
      if (!rule.expression || rule.expression.trim().length === 0) {
        errors.push({
          fieldId: `validationRules[${ruleIndex}].expression`,
          message: 'Validation rule expression is required',
          severity: 'error'
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async validateInstanceData(template: ClinicalTemplate, data: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Validate required fields
    template.sections.forEach(section => {
      section.fields.forEach(field => {
        if (field.isRequired && (!data[field.name] || data[field.name] === '')) {
          errors.push({
            fieldId: field.name,
            message: `${field.label} is required`,
            severity: 'error'
          });
        }

        // Field-specific validation
        const fieldValue = data[field.name];
        if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
          const fieldErrors = this.validateFieldValue(field, fieldValue);
          errors.push(...fieldErrors);
        }
      });
    });

    // Custom validation rules
    template.validationRules.forEach(rule => {
      if (rule.isActive) {
        try {
          const isValid = this.evaluateValidationRule(rule.expression, data);
          if (!isValid) {
            errors.push({
              fieldId: rule.id,
              message: rule.errorMessage,
              severity: rule.severity,
              code: rule.name
            });
          }
        } catch (error) {
          errors.push({
            fieldId: rule.id,
            message: `Validation rule error: ${error.message}`,
            severity: 'error'
          });
        }
      }
    });

    return errors;
  }

  /**
   * HELPER METHODS
   */

  private async initializeDefaultTemplates(): Promise<void> {
    // Initialize with common clinical templates
    const defaultTemplates = [
      await this.createHistoryAndPhysicalTemplate(),
      await this.createProgressNoteTemplate(),
      await this.createDischargeSummaryTemplate(),
      await this.createConsultationNoteTemplate(),
      await this.createNursingNoteTemplate()
    ];

    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }
  }

  private async createHistoryAndPhysicalTemplate(): Promise<ClinicalTemplate> {
    return {
      id: this.generateId(),
      name: 'History and Physical Examination',
      type: 'History_and_Physical',
      version: '1.0.0',
      description: 'Comprehensive history and physical examination documentation',
      category: 'Admission',
      isActive: true,
      isDefault: true,
      createdBy: 'system',
      createdDate: new Date(),
      lastModifiedBy: 'system',
      lastModifiedDate: new Date(),
      complianceRequired: true,
      autoSave: true,
      sections: [
        {
          id: 'chief_complaint',
          title: 'Chief Complaint',
          order: 1,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'chief_complaint_text',
              name: 'chief_complaint',
              label: 'Chief Complaint',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              placeholder: 'Brief statement of the problem or symptom that brought the patient to seek medical care'
            }
          ]
        },
        {
          id: 'history_present_illness',
          title: 'History of Present Illness',
          order: 2,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'hpi_text',
              name: 'history_present_illness',
              label: 'History of Present Illness',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              placeholder: 'Detailed description of the present illness including onset, duration, quality, severity, timing, context, modifying factors, and associated symptoms'
            }
          ]
        },
        {
          id: 'review_of_systems',
          title: 'Review of Systems',
          order: 3,
          isRequired: true,
          isVisible: true,
          isCollapsible: true,
          fields: [
            {
              id: 'ros_constitutional',
              name: 'ros_constitutional',
              label: 'Constitutional',
              type: 'textarea',
              isRequired: false,
              isReadOnly: false,
              order: 1,
              placeholder: 'Fever, chills, night sweats, weight loss/gain, fatigue'
            },
            {
              id: 'ros_cardiovascular',
              name: 'ros_cardiovascular',
              label: 'Cardiovascular',
              type: 'textarea',
              isRequired: false,
              isReadOnly: false,
              order: 2,
              placeholder: 'Chest pain, palpitations, shortness of breath, orthopnea, edema'
            },
            {
              id: 'ros_respiratory',
              name: 'ros_respiratory',
              label: 'Respiratory',
              type: 'textarea',
              isRequired: false,
              isReadOnly: false,
              order: 3,
              placeholder: 'Shortness of breath, cough, sputum, wheezing, chest pain'
            }
          ]
        },
        {
          id: 'physical_examination',
          title: 'Physical Examination',
          order: 4,
          isRequired: true,
          isVisible: true,
          isCollapsible: true,
          fields: [
            {
              id: 'vital_signs',
              name: 'vital_signs',
              label: 'Vital Signs',
              type: 'vitals',
              isRequired: true,
              isReadOnly: false,
              order: 1
            },
            {
              id: 'general_appearance',
              name: 'general_appearance',
              label: 'General Appearance',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 2,
              placeholder: 'Overall appearance, distress level, grooming, etc.'
            }
          ]
        },
        {
          id: 'assessment_plan',
          title: 'Assessment and Plan',
          order: 5,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'assessment',
              name: 'assessment',
              label: 'Assessment',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              placeholder: 'Clinical assessment and differential diagnosis'
            },
            {
              id: 'plan',
              name: 'plan',
              label: 'Plan',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 2,
              placeholder: 'Treatment plan, medications, follow-up, patient education'
            }
          ]
        }
      ],
      metadata: {
        tags: ['admission', 'comprehensive', 'h&p'],
        keywords: ['history', 'physical', 'examination', 'admission'],
        clinicalContext: ['hospital_admission', 'comprehensive_exam'],
        language: 'en',
        jurisdiction: 'US',
        complianceFramework: ['CMS', 'Joint Commission'],
        reviewCycle: 12
      },
      validationRules: [
        {
          id: 'require_chief_complaint',
          name: 'Chief Complaint Required',
          expression: 'chief_complaint && chief_complaint.length > 0',
          errorMessage: 'Chief complaint must be documented',
          severity: 'error',
          isActive: true
        }
      ]
    };
  }

  private async createProgressNoteTemplate(): Promise<ClinicalTemplate> {
    return {
      id: this.generateId(),
      name: 'Progress Note',
      type: 'Progress_Note',
      version: '1.0.0',
      description: 'Daily progress note for ongoing patient care',
      category: 'Progress',
      isActive: true,
      isDefault: true,
      createdBy: 'system',
      createdDate: new Date(),
      lastModifiedBy: 'system',
      lastModifiedDate: new Date(),
      complianceRequired: true,
      autoSave: true,
      sections: [
        {
          id: 'subjective',
          title: 'Subjective',
          order: 1,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'subjective_data',
              name: 'subjective',
              label: 'Subjective Data',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              placeholder: 'Patient reported symptoms, concerns, and responses to treatment'
            }
          ]
        },
        {
          id: 'objective',
          title: 'Objective',
          order: 2,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'vital_signs',
              name: 'vital_signs',
              label: 'Vital Signs',
              type: 'vitals',
              isRequired: true,
              isReadOnly: false,
              order: 1
            },
            {
              id: 'physical_exam',
              name: 'physical_exam',
              label: 'Physical Examination',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 2,
              placeholder: 'Objective physical examination findings'
            }
          ]
        },
        {
          id: 'assessment',
          title: 'Assessment',
          order: 3,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'clinical_assessment',
              name: 'assessment',
              label: 'Clinical Assessment',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              placeholder: 'Clinical interpretation of subjective and objective data'
            }
          ]
        },
        {
          id: 'plan',
          title: 'Plan',
          order: 4,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'treatment_plan',
              name: 'plan',
              label: 'Treatment Plan',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              placeholder: 'Planned interventions, medications, monitoring, and follow-up'
            }
          ]
        }
      ],
      metadata: {
        tags: ['progress', 'soap', 'daily'],
        keywords: ['progress', 'note', 'soap', 'daily'],
        clinicalContext: ['inpatient_care', 'outpatient_visit'],
        language: 'en',
        jurisdiction: 'US',
        reviewCycle: 6
      },
      validationRules: []
    };
  }

  private async createDischargeSummaryTemplate(): Promise<ClinicalTemplate> {
    return {
      id: this.generateId(),
      name: 'Discharge Summary',
      type: 'Discharge_Summary',
      version: '1.0.0',
      description: 'Comprehensive discharge summary documentation',
      category: 'Discharge',
      isActive: true,
      isDefault: true,
      createdBy: 'system',
      createdDate: new Date(),
      lastModifiedBy: 'system',
      lastModifiedDate: new Date(),
      complianceRequired: true,
      autoSave: true,
      sections: [
        {
          id: 'admission_diagnosis',
          title: 'Admission Diagnosis',
          order: 1,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'admission_diagnosis',
              name: 'admission_diagnosis',
              label: 'Admission Diagnosis',
              type: 'diagnosis',
              isRequired: true,
              isReadOnly: false,
              order: 1
            }
          ]
        },
        {
          id: 'discharge_diagnosis',
          title: 'Discharge Diagnosis',
          order: 2,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'discharge_diagnosis',
              name: 'discharge_diagnosis',
              label: 'Discharge Diagnosis',
              type: 'diagnosis',
              isRequired: true,
              isReadOnly: false,
              order: 1
            }
          ]
        },
        {
          id: 'hospital_course',
          title: 'Hospital Course',
          order: 3,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'hospital_course',
              name: 'hospital_course',
              label: 'Hospital Course',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              placeholder: 'Summary of the patient\'s hospital stay, treatments, and response'
            }
          ]
        },
        {
          id: 'discharge_instructions',
          title: 'Discharge Instructions',
          order: 4,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'discharge_medications',
              name: 'discharge_medications',
              label: 'Discharge Medications',
              type: 'medication',
              isRequired: true,
              isReadOnly: false,
              order: 1
            },
            {
              id: 'follow_up_instructions',
              name: 'follow_up_instructions',
              label: 'Follow-up Instructions',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 2,
              placeholder: 'Follow-up appointments, monitoring, and care instructions'
            }
          ]
        }
      ],
      metadata: {
        tags: ['discharge', 'summary', 'transition'],
        keywords: ['discharge', 'summary', 'transition', 'continuity'],
        clinicalContext: ['hospital_discharge', 'care_transition'],
        language: 'en',
        jurisdiction: 'US',
        complianceFramework: ['CMS', 'Joint Commission'],
        reviewCycle: 12
      },
      validationRules: []
    };
  }

  private async createConsultationNoteTemplate(): Promise<ClinicalTemplate> {
    return {
      id: this.generateId(),
      name: 'Consultation Note',
      type: 'Consultation_Note',
      version: '1.0.0',
      description: 'Specialist consultation documentation',
      category: 'Outpatient',
      isActive: true,
      isDefault: true,
      createdBy: 'system',
      createdDate: new Date(),
      lastModifiedBy: 'system',
      lastModifiedDate: new Date(),
      complianceRequired: true,
      autoSave: true,
      sections: [
        {
          id: 'reason_for_consultation',
          title: 'Reason for Consultation',
          order: 1,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'consultation_reason',
              name: 'consultation_reason',
              label: 'Reason for Consultation',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              placeholder: 'Specific reason for specialist consultation and referring provider questions'
            }
          ]
        },
        {
          id: 'consultant_findings',
          title: 'Consultant Findings',
          order: 2,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'consultant_assessment',
              name: 'consultant_assessment',
              label: 'Consultant Assessment',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              placeholder: 'Specialist assessment and findings'
            }
          ]
        },
        {
          id: 'recommendations',
          title: 'Recommendations',
          order: 3,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'consultant_recommendations',
              name: 'recommendations',
              label: 'Recommendations',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              placeholder: 'Specific recommendations for care, treatment, and follow-up'
            }
          ]
        }
      ],
      metadata: {
        tags: ['consultation', 'specialist', 'referral'],
        keywords: ['consultation', 'specialist', 'referral', 'expert'],
        clinicalContext: ['specialist_consultation', 'referral_response'],
        language: 'en',
        jurisdiction: 'US',
        reviewCycle: 12
      },
      validationRules: []
    };
  }

  private async createNursingNoteTemplate(): Promise<ClinicalTemplate> {
    return {
      id: this.generateId(),
      name: 'Nursing Note',
      type: 'Nursing_Note',
      version: '1.0.0',
      description: 'Nursing care documentation and assessment',
      category: 'Progress',
      isActive: true,
      isDefault: true,
      createdBy: 'system',
      createdDate: new Date(),
      lastModifiedBy: 'system',
      lastModifiedDate: new Date(),
      complianceRequired: true,
      autoSave: true,
      sections: [
        {
          id: 'nursing_assessment',
          title: 'Nursing Assessment',
          order: 1,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'patient_condition',
              name: 'patient_condition',
              label: 'Patient Condition',
              type: 'select',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              options: [
                { value: 'stable', label: 'Stable' },
                { value: 'improved', label: 'Improved' },
                { value: 'declined', label: 'Declined' },
                { value: 'critical', label: 'Critical' }
              ]
            },
            {
              id: 'nursing_observations',
              name: 'nursing_observations',
              label: 'Nursing Observations',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 2,
              placeholder: 'Detailed nursing observations and assessments'
            }
          ]
        },
        {
          id: 'interventions',
          title: 'Nursing Interventions',
          order: 2,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'interventions_provided',
              name: 'interventions_provided',
              label: 'Interventions Provided',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              placeholder: 'Nursing interventions and care provided'
            }
          ]
        },
        {
          id: 'patient_response',
          title: 'Patient Response',
          order: 3,
          isRequired: true,
          isVisible: true,
          isCollapsible: false,
          fields: [
            {
              id: 'patient_response',
              name: 'patient_response',
              label: 'Patient Response to Care',
              type: 'textarea',
              isRequired: true,
              isReadOnly: false,
              order: 1,
              placeholder: 'Patient response to interventions and care'
            }
          ]
        }
      ],
      metadata: {
        tags: ['nursing', 'care', 'assessment'],
        keywords: ['nursing', 'care', 'assessment', 'intervention'],
        clinicalContext: ['nursing_care', 'patient_monitoring'],
        language: 'en',
        jurisdiction: 'US',
        reviewCycle: 6
      },
      validationRules: []
    };
  }

  private validateFieldValue(field: any, value: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (field.validation) {
      const validation = field.validation;

      if (validation.minLength && value.length < validation.minLength) {
        errors.push({
          fieldId: field.name,
          message: validation.errorMessage || `Minimum length is ${validation.minLength}`,
          severity: 'error'
        });
      }

      if (validation.maxLength && value.length > validation.maxLength) {
        errors.push({
          fieldId: field.name,
          message: validation.errorMessage || `Maximum length is ${validation.maxLength}`,
          severity: 'error'
        });
      }

      if (validation.min && Number(value) < validation.min) {
        errors.push({
          fieldId: field.name,
          message: validation.errorMessage || `Minimum value is ${validation.min}`,
          severity: 'error'
        });
      }

      if (validation.max && Number(value) > validation.max) {
        errors.push({
          fieldId: field.name,
          message: validation.errorMessage || `Maximum value is ${validation.max}`,
          severity: 'error'
        });
      }

      if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
        errors.push({
          fieldId: field.name,
          message: validation.errorMessage || 'Invalid format',
          severity: 'error'
        });
      }
    }

    return errors;
  }

  private evaluateValidationRule(expression: string, data: Record<string, any>): boolean {
    // Simple expression evaluator - in production, use a proper expression engine
    try {
      const func = new Function('data', `with(data) { return ${expression}; }`);
      return func(data);
    } catch (error) {
      throw new Error(`Invalid validation expression: ${expression}`);
    }
  }

  private detectChanges(oldData: Record<string, any>, newData: Record<string, any>): FieldChange[] {
    const changes: FieldChange[] = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    for (const key of allKeys) {
      const oldValue = oldData[key];
      const newValue = newData[key];

      if (oldValue === undefined && newValue !== undefined) {
        changes.push({
          fieldId: key,
          fieldName: key,
          oldValue: null,
          newValue,
          changeType: 'added'
        });
      } else if (oldValue !== undefined && newValue === undefined) {
        changes.push({
          fieldId: key,
          fieldName: key,
          oldValue,
          newValue: null,
          changeType: 'deleted'
        });
      } else if (oldValue !== newValue) {
        changes.push({
          fieldId: key,
          fieldName: key,
          oldValue,
          newValue,
          changeType: 'modified'
        });
      }
    }

    return changes;
  }

  private isSignificantAmendment(changes: FieldChange[]): boolean {
    // Define criteria for significant amendments
    const significantFields = ['diagnosis', 'treatment_plan', 'medications', 'assessment'];
    return changes.some(change => 
      significantFields.some(field => change.fieldName.includes(field))
    );
  }

  private determineInstanceStatus(instance: TemplateInstance): TemplateInstanceStatus {
    if (instance.isSigned) return 'signed';
    if (instance.validationErrors.some(error => error.severity === 'error')) return 'draft';
    
    // Check if all required fields are completed
    const template = this.templates.get(instance.templateId);
    if (template) {
      const requiredFields = template.sections
        .flatMap(section => section.fields)
        .filter(field => field.isRequired);
      
      const completedFields = requiredFields.filter(field => 
        instance.data[field.name] !== undefined && 
        instance.data[field.name] !== null && 
        instance.data[field.name] !== ''
      );

      if (completedFields.length === requiredFields.length) {
        return 'completed';
      }
    }

    return 'in_progress';
  }

  private async getActiveTemplateInstances(templateId: string): Promise<TemplateInstance[]> {
    return Array.from(this.templateInstances.values())
      .filter(instance => 
        instance.templateId === templateId && 
        !['deleted', 'archived'].includes(instance.status)
      );
  }

  private incrementVersion(currentVersion: string): string {
    const parts = currentVersion.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  private async logActivity(action: string, resourceId: string, userId: string): Promise<void> {
    // In production, this would log to an audit system
    console.log(`Template Activity: ${action} - Resource: ${resourceId} - User: ${userId} - Time: ${new Date().toISOString()}`);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

// Default Form Builder Implementation
class DefaultFormBuilder implements ClinicalFormBuilder {
  buildTemplate(config: TemplateBuilderConfig): ClinicalTemplate {
    const template: ClinicalTemplate = {
      id: this.generateId(),
      name: config.name,
      type: config.type,
      version: '1.0.0',
      description: '',
      category: config.category,
      isActive: true,
      isDefault: false,
      createdBy: 'system',
      createdDate: new Date(),
      lastModifiedBy: 'system',
      lastModifiedDate: new Date(),
      sections: config.sections.map((sectionConfig, index) => ({
        id: this.generateId(),
        title: sectionConfig.title,
        order: index + 1,
        isRequired: sectionConfig.isRequired || false,
        isVisible: true,
        isCollapsible: sectionConfig.isCollapsible || false,
        fields: sectionConfig.fields.map((fieldConfig, fieldIndex) => ({
          id: this.generateId(),
          name: fieldConfig.name,
          label: fieldConfig.label,
          type: fieldConfig.type,
          isRequired: fieldConfig.isRequired || false,
          isReadOnly: false,
          order: fieldIndex + 1,
          options: fieldConfig.options?.map(option => ({
            value: option,
            label: option
          })),
          validation: fieldConfig.validation
        }))
      })),
      metadata: {
        tags: [],
        keywords: [],
        clinicalContext: [],
        language: 'en',
        jurisdiction: 'US',
        reviewCycle: 12,
        ...config.metadata
      },
      validationRules: config.validation || [],
      complianceRequired: false,
      autoSave: true
    };

    return template;
  }

  validateTemplate(template: ClinicalTemplate): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!template.name || template.name.trim().length === 0) {
      errors.push({
        fieldId: 'name',
        message: 'Template name is required',
        severity: 'error'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  previewTemplate(template: ClinicalTemplate): any {
    return {
      html: this.generateHTML(template),
      css: this.generateCSS(),
      metadata: {
        fieldCount: template.sections.reduce((count, section) => count + section.fields.length, 0),
        sectionCount: template.sections.length,
        estimatedTime: this.estimateCompletionTime(template),
        complexity: this.assessComplexity(template)
      }
    };
  }

  exportTemplate(templateId: string, format: any): string {
    // Implementation would depend on the format
    return JSON.stringify({ templateId, format });
  }

  importTemplate(data: string, format: any): ClinicalTemplate {
    // Implementation would depend on the format
    return JSON.parse(data);
  }

  private generateHTML(template: ClinicalTemplate): string {
    // Generate HTML representation of the template
    return `<form class="clinical-template">${template.sections.map(section => 
      `<section class="template-section">
        <h3>${section.title}</h3>
        ${section.fields.map(field => 
          `<div class="field-group">
            <label for="${field.name}">${field.label}${field.isRequired ? ' *' : ''}</label>
            ${this.generateFieldHTML(field)}
          </div>`
        ).join('')}
      </section>`
    ).join('')}</form>`;
  }

  private generateFieldHTML(field: any): string {
    switch (field.type) {
      case 'textarea':
        return `<textarea id="${field.name}" name="${field.name}" placeholder="${field.placeholder || ''}"></textarea>`;
      case 'select':
        return `<select id="${field.name}" name="${field.name}">
          ${field.options?.map((option: any) => `<option value="${option.value}">${option.label}</option>`).join('') || ''}
        </select>`;
      default:
        return `<input type="text" id="${field.name}" name="${field.name}" placeholder="${field.placeholder || ''}" />`;
    }
  }

  private generateCSS(): string {
    return `
      .clinical-template { max-width: 800px; margin: 0 auto; padding: 20px; }
      .template-section { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
      .field-group { margin-bottom: 15px; }
      .field-group label { display: block; margin-bottom: 5px; font-weight: bold; }
      .field-group input, .field-group textarea, .field-group select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 3px; }
      .field-group textarea { min-height: 100px; resize: vertical; }
    `;
  }

  private estimateCompletionTime(template: ClinicalTemplate): number {
    // Estimate completion time in minutes based on field types and complexity
    let time = 0;
    template.sections.forEach(section => {
      section.fields.forEach(field => {
        switch (field.type) {
          case 'textarea':
            time += 2;
            break;
          case 'select':
          case 'radio':
            time += 0.5;
            break;
          default:
            time += 1;
        }
      });
    });
    return Math.max(5, Math.round(time));
  }

  private assessComplexity(template: ClinicalTemplate): 'low' | 'medium' | 'high' {
    const fieldCount = template.sections.reduce((count, section) => count + section.fields.length, 0);
    const validationRules = template.validationRules.length;
    
    if (fieldCount <= 10 && validationRules <= 2) return 'low';
    if (fieldCount <= 25 && validationRules <= 5) return 'medium';
    return 'high';
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}