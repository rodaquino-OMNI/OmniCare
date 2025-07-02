import { v4 as uuidv4 } from 'uuid';

export interface ClinicalTemplate {
  id: string;
  name: string;
  category: string;
  specialty?: string;
  content: string;
  variables?: string[];
  tags: string[];
  isSystem: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export class ClinicalTemplatesService {
  private templates: Map<string, ClinicalTemplate> = new Map();

  constructor() {
    this.initializeSystemTemplates();
  }

  private initializeSystemTemplates(): void {
    const systemTemplates: Omit<ClinicalTemplate, 'id' | 'createdAt' | 'updatedAt' | 'version'>[] = [
      // Progress Notes
      {
        name: 'SOAP Note',
        category: 'Progress Notes',
        content: `Subjective:
{{chief_complaint}}
{{history_present_illness}}
{{review_of_systems}}

Objective:
Vital Signs: {{vital_signs}}
Physical Exam: {{physical_exam}}
Laboratory Results: {{lab_results}}
Imaging Results: {{imaging_results}}

Assessment:
{{assessment}}
{{differential_diagnosis}}

Plan:
{{treatment_plan}}
{{medications}}
{{follow_up}}`,
        variables: ['chief_complaint', 'history_present_illness', 'review_of_systems', 'vital_signs', 'physical_exam', 'lab_results', 'imaging_results', 'assessment', 'differential_diagnosis', 'treatment_plan', 'medications', 'follow_up'],
        tags: ['soap', 'progress', 'general'],
        isSystem: true,
        createdBy: 'system'
      },
      {
        name: 'DAP Note (Mental Health)',
        category: 'Progress Notes',
        specialty: 'Psychiatry',
        content: `Data:
{{observations}}
{{mental_status_exam}}
{{reported_symptoms}}

Assessment:
{{clinical_assessment}}
{{diagnosis_update}}
{{risk_assessment}}

Plan:
{{treatment_interventions}}
{{medication_changes}}
{{next_appointment}}
{{safety_plan}}`,
        variables: ['observations', 'mental_status_exam', 'reported_symptoms', 'clinical_assessment', 'diagnosis_update', 'risk_assessment', 'treatment_interventions', 'medication_changes', 'next_appointment', 'safety_plan'],
        tags: ['dap', 'mental-health', 'psychiatry'],
        isSystem: true,
        createdBy: 'system'
      },

      // Admission Notes
      {
        name: 'H&P (History and Physical)',
        category: 'Admission',
        content: `CHIEF COMPLAINT:
{{chief_complaint}}

HISTORY OF PRESENT ILLNESS:
{{hpi}}

PAST MEDICAL HISTORY:
{{pmh}}

PAST SURGICAL HISTORY:
{{psh}}

MEDICATIONS:
{{current_medications}}

ALLERGIES:
{{allergies}}

SOCIAL HISTORY:
{{social_history}}

FAMILY HISTORY:
{{family_history}}

REVIEW OF SYSTEMS:
Constitutional: {{ros_constitutional}}
HEENT: {{ros_heent}}
Cardiovascular: {{ros_cardiovascular}}
Pulmonary: {{ros_pulmonary}}
GI: {{ros_gi}}
GU: {{ros_gu}}
Musculoskeletal: {{ros_musculoskeletal}}
Neurological: {{ros_neurological}}
Psychiatric: {{ros_psychiatric}}
Endocrine: {{ros_endocrine}}
Hematologic: {{ros_hematologic}}
Skin: {{ros_skin}}

PHYSICAL EXAMINATION:
Vital Signs: {{vital_signs}}
General: {{pe_general}}
HEENT: {{pe_heent}}
Neck: {{pe_neck}}
Cardiovascular: {{pe_cardiovascular}}
Pulmonary: {{pe_pulmonary}}
Abdomen: {{pe_abdomen}}
Extremities: {{pe_extremities}}
Neurological: {{pe_neurological}}
Skin: {{pe_skin}}

DIAGNOSTIC RESULTS:
Laboratory: {{lab_results}}
Imaging: {{imaging_results}}
Other: {{other_diagnostics}}

ASSESSMENT AND PLAN:
{{assessment}}
{{problem_list}}
{{treatment_plan}}

DISPOSITION:
{{disposition}}`,
        variables: [
          'chief_complaint', 'hpi', 'pmh', 'psh', 'current_medications', 'allergies',
          'social_history', 'family_history', 'ros_constitutional', 'ros_heent',
          'ros_cardiovascular', 'ros_pulmonary', 'ros_gi', 'ros_gu', 'ros_musculoskeletal',
          'ros_neurological', 'ros_psychiatric', 'ros_endocrine', 'ros_hematologic',
          'ros_skin', 'vital_signs', 'pe_general', 'pe_heent', 'pe_neck',
          'pe_cardiovascular', 'pe_pulmonary', 'pe_abdomen', 'pe_extremities',
          'pe_neurological', 'pe_skin', 'lab_results', 'imaging_results',
          'other_diagnostics', 'assessment', 'problem_list', 'treatment_plan', 'disposition'
        ],
        tags: ['h&p', 'admission', 'comprehensive'],
        isSystem: true,
        createdBy: 'system'
      },

      // Discharge Summary
      {
        name: 'Discharge Summary',
        category: 'Discharge',
        content: `DISCHARGE SUMMARY

Patient Name: {{patient_name}}
MRN: {{mrn}}
Admission Date: {{admission_date}}
Discharge Date: {{discharge_date}}
Length of Stay: {{los}}

ADMITTING DIAGNOSIS:
{{admitting_diagnosis}}

DISCHARGE DIAGNOSIS:
Principal: {{principal_diagnosis}}
Secondary: {{secondary_diagnoses}}

HOSPITAL COURSE:
{{hospital_course}}

PROCEDURES PERFORMED:
{{procedures}}

CONSULTATIONS:
{{consultations}}

DISCHARGE MEDICATIONS:
{{discharge_medications}}

MEDICATION CHANGES:
New Medications: {{new_medications}}
Discontinued Medications: {{discontinued_medications}}
Changed Medications: {{changed_medications}}

DISCHARGE INSTRUCTIONS:
Activity: {{activity_instructions}}
Diet: {{diet_instructions}}
Wound Care: {{wound_care}}
Other Instructions: {{other_instructions}}

FOLLOW-UP APPOINTMENTS:
{{follow_up_appointments}}

PENDING RESULTS:
{{pending_results}}

DISCHARGE CONDITION:
{{discharge_condition}}

DISCHARGE DISPOSITION:
{{discharge_disposition}}`,
        variables: [
          'patient_name', 'mrn', 'admission_date', 'discharge_date', 'los',
          'admitting_diagnosis', 'principal_diagnosis', 'secondary_diagnoses',
          'hospital_course', 'procedures', 'consultations', 'discharge_medications',
          'new_medications', 'discontinued_medications', 'changed_medications',
          'activity_instructions', 'diet_instructions', 'wound_care',
          'other_instructions', 'follow_up_appointments', 'pending_results',
          'discharge_condition', 'discharge_disposition'
        ],
        tags: ['discharge', 'summary', 'comprehensive'],
        isSystem: true,
        createdBy: 'system'
      },

      // Procedure Notes
      {
        name: 'Procedure Note',
        category: 'Procedure',
        content: `PROCEDURE NOTE

Date/Time: {{procedure_datetime}}
Procedure: {{procedure_name}}
Indication: {{indication}}
Operator: {{operator}}
Assistant(s): {{assistants}}
Anesthesia: {{anesthesia_type}}

CONSENT:
{{consent_details}}

PRE-PROCEDURE:
Timeout performed: {{timeout}}
Patient position: {{patient_position}}
Prep: {{prep_details}}

PROCEDURE DETAILS:
{{procedure_details}}

FINDINGS:
{{findings}}

SPECIMENS:
{{specimens}}

COMPLICATIONS:
{{complications}}

ESTIMATED BLOOD LOSS:
{{ebl}}

POST-PROCEDURE:
Patient condition: {{post_procedure_condition}}
Recovery location: {{recovery_location}}
Post-procedure orders: {{post_procedure_orders}}

PLAN:
{{follow_up_plan}}`,
        variables: [
          'procedure_datetime', 'procedure_name', 'indication', 'operator',
          'assistants', 'anesthesia_type', 'consent_details', 'timeout',
          'patient_position', 'prep_details', 'procedure_details', 'findings',
          'specimens', 'complications', 'ebl', 'post_procedure_condition',
          'recovery_location', 'post_procedure_orders', 'follow_up_plan'
        ],
        tags: ['procedure', 'operative', 'documentation'],
        isSystem: true,
        createdBy: 'system'
      },

      // Consultation Note
      {
        name: 'Consultation Note',
        category: 'Consultation',
        content: `CONSULTATION NOTE

Consulting Service: {{consulting_service}}
Requesting Provider: {{requesting_provider}}
Date of Consultation: {{consultation_date}}
Reason for Consultation: {{reason_for_consult}}

HISTORY OF PRESENT ILLNESS:
{{hpi}}

PERTINENT PAST MEDICAL HISTORY:
{{relevant_pmh}}

CURRENT MEDICATIONS:
{{current_medications}}

ALLERGIES:
{{allergies}}

PHYSICAL EXAMINATION:
{{focused_physical_exam}}

DIAGNOSTIC DATA:
{{diagnostic_results}}

ASSESSMENT:
{{consultant_assessment}}

RECOMMENDATIONS:
{{recommendations}}

FOLLOW-UP:
{{follow_up_plan}}

Thank you for this interesting consultation.`,
        variables: [
          'consulting_service', 'requesting_provider', 'consultation_date',
          'reason_for_consult', 'hpi', 'relevant_pmh', 'current_medications',
          'allergies', 'focused_physical_exam', 'diagnostic_results',
          'consultant_assessment', 'recommendations', 'follow_up_plan'
        ],
        tags: ['consultation', 'consult', 'specialist'],
        isSystem: true,
        createdBy: 'system'
      },

      // Emergency Department Note
      {
        name: 'Emergency Department Note',
        category: 'Emergency',
        content: `EMERGENCY DEPARTMENT NOTE

CHIEF COMPLAINT:
{{chief_complaint}}

TRIAGE:
Arrival Time: {{arrival_time}}
Triage Level: {{triage_level}}
Vital Signs: {{triage_vitals}}

HISTORY OF PRESENT ILLNESS:
{{hpi}}

PERTINENT ROS:
{{pertinent_ros}}

PAST MEDICAL HISTORY:
{{pmh}}

MEDICATIONS:
{{medications}}

ALLERGIES:
{{allergies}}

PHYSICAL EXAMINATION:
{{physical_exam}}

EMERGENCY DEPARTMENT COURSE:
{{ed_course}}

DIAGNOSTIC STUDIES:
Laboratory: {{lab_results}}
Imaging: {{imaging_results}}
EKG: {{ekg_results}}
Other: {{other_studies}}

PROCEDURES:
{{procedures_performed}}

CONSULTATIONS:
{{consultations}}

MEDICAL DECISION MAKING:
{{mdm}}

DISPOSITION:
{{disposition}}
Discharge Instructions: {{discharge_instructions}}
Follow-up: {{follow_up}}

CONDITION AT DISCHARGE:
{{discharge_condition}}`,
        variables: [
          'chief_complaint', 'arrival_time', 'triage_level', 'triage_vitals',
          'hpi', 'pertinent_ros', 'pmh', 'medications', 'allergies',
          'physical_exam', 'ed_course', 'lab_results', 'imaging_results',
          'ekg_results', 'other_studies', 'procedures_performed', 'consultations',
          'mdm', 'disposition', 'discharge_instructions', 'follow_up',
          'discharge_condition'
        ],
        tags: ['emergency', 'ed', 'acute-care'],
        isSystem: true,
        createdBy: 'system'
      },

      // Nursing Assessment
      {
        name: 'Nursing Assessment',
        category: 'Nursing',
        content: `NURSING ASSESSMENT

Date/Time: {{assessment_datetime}}
Nurse: {{nurse_name}}

VITAL SIGNS:
{{vital_signs}}
Pain Score: {{pain_score}}

GENERAL ASSESSMENT:
Appearance: {{appearance}}
Level of Consciousness: {{loc}}
Orientation: {{orientation}}
Mood/Affect: {{mood_affect}}

SYSTEMS ASSESSMENT:
Neurological: {{neuro_assessment}}
Cardiovascular: {{cardio_assessment}}
Respiratory: {{resp_assessment}}
Gastrointestinal: {{gi_assessment}}
Genitourinary: {{gu_assessment}}
Musculoskeletal: {{msk_assessment}}
Integumentary: {{skin_assessment}}

FUNCTIONAL STATUS:
Mobility: {{mobility}}
ADLs: {{adl_status}}
Fall Risk: {{fall_risk}}

PSYCHOSOCIAL:
{{psychosocial_assessment}}

EDUCATION NEEDS:
{{education_needs}}

DISCHARGE PLANNING:
{{discharge_planning}}

NURSING DIAGNOSES:
{{nursing_diagnoses}}

PLAN OF CARE:
{{nursing_plan}}`,
        variables: [
          'assessment_datetime', 'nurse_name', 'vital_signs', 'pain_score',
          'appearance', 'loc', 'orientation', 'mood_affect', 'neuro_assessment',
          'cardio_assessment', 'resp_assessment', 'gi_assessment', 'gu_assessment',
          'msk_assessment', 'skin_assessment', 'mobility', 'adl_status',
          'fall_risk', 'psychosocial_assessment', 'education_needs',
          'discharge_planning', 'nursing_diagnoses', 'nursing_plan'
        ],
        tags: ['nursing', 'assessment', 'patient-care'],
        isSystem: true,
        createdBy: 'system'
      }
    ];

    // Create templates with proper IDs and timestamps
    systemTemplates.forEach(template => {
      const now = new Date().toISOString();
      const fullTemplate: ClinicalTemplate = {
        ...template,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
        version: 1
      };
      this.templates.set(fullTemplate.id, fullTemplate);
    });
  }

  /**
   * Get all templates
   */
  getAllTemplates(): ClinicalTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): ClinicalTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.category === category);
  }

  /**
   * Get templates by specialty
   */
  getTemplatesBySpecialty(specialty: string): ClinicalTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.specialty === specialty);
  }

  /**
   * Get template by ID
   */
  getTemplateById(id: string): ClinicalTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Search templates
   */
  searchTemplates(query: string): ClinicalTemplate[] {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.templates.values())
      .filter(template =>
        template.name.toLowerCase().includes(lowercaseQuery) ||
        template.category.toLowerCase().includes(lowercaseQuery) ||
        template.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)) ||
        template.content.toLowerCase().includes(lowercaseQuery)
      );
  }

  /**
   * Create custom template
   */
  createTemplate(
    name: string,
    category: string,
    content: string,
    tags: string[],
    createdBy: string,
    specialty?: string
  ): ClinicalTemplate {
    const now = new Date().toISOString();
    const template: ClinicalTemplate = {
      id: uuidv4(),
      name,
      category,
      specialty,
      content,
      variables: this.extractVariables(content),
      tags,
      isSystem: false,
      createdBy,
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    this.templates.set(template.id, template);
    return template;
  }

  /**
   * Update template
   */
  updateTemplate(
    id: string,
    updates: Partial<Omit<ClinicalTemplate, 'id' | 'createdAt' | 'createdBy' | 'isSystem'>>
  ): ClinicalTemplate | undefined {
    const template = this.templates.get(id);
    if (!template || template.isSystem) {
      return undefined; // Cannot update system templates
    }

    const updatedTemplate: ClinicalTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date().toISOString(),
      version: template.version + 1,
      variables: updates.content ? this.extractVariables(updates.content) : template.variables
    };

    this.templates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  /**
   * Delete template
   */
  deleteTemplate(id: string): boolean {
    const template = this.templates.get(id);
    if (!template || template.isSystem) {
      return false; // Cannot delete system templates
    }

    return this.templates.delete(id);
  }

  /**
   * Apply template with variables
   */
  applyTemplate(templateId: string, variables: Record<string, string>): string | undefined {
    const template = this.templates.get(templateId);
    if (!template) {
      return undefined;
    }

    let content = template.content;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, value);
    });

    // Replace any remaining variables with empty string
    content = content.replace(/{{[^}]+}}/g, '');

    return content;
  }

  /**
   * Extract variables from template content
   */
  private extractVariables(content: string): string[] {
    const regex = /{{([^}]+)}}/g;
    const variables = new Set<string>();
    let match;

    while ((match = regex.exec(content)) !== null) {
      variables.add(match[1].trim());
    }

    return Array.from(variables);
  }

  /**
   * Get template categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.templates.forEach(template => {
      categories.add(template.category);
    });
    return Array.from(categories).sort();
  }

  /**
   * Get template specialties
   */
  getSpecialties(): string[] {
    const specialties = new Set<string>();
    this.templates.forEach(template => {
      if (template.specialty) {
        specialties.add(template.specialty);
      }
    });
    return Array.from(specialties).sort();
  }

  /**
   * Export templates
   */
  exportTemplates(templateIds?: string[]): ClinicalTemplate[] {
    if (templateIds) {
      return templateIds
        .map(id => this.templates.get(id))
        .filter((template): template is ClinicalTemplate => template !== undefined);
    }
    return this.getAllTemplates();
  }

  /**
   * Import templates
   */
  importTemplates(templates: ClinicalTemplate[], overwrite: boolean = false): number {
    let imported = 0;

    templates.forEach(template => {
      if (!template.isSystem && (overwrite || !this.templates.has(template.id))) {
        this.templates.set(template.id, {
          ...template,
          updatedAt: new Date().toISOString()
        });
        imported++;
      }
    });

    return imported;
  }
}

// Export singleton instance
export const clinicalTemplatesService = new ClinicalTemplatesService();