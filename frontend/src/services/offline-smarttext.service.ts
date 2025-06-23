'use client';

// Utility function to generate unique IDs
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export interface SmartTextTemplate {
  id: string;
  name: string;
  category: string;
  specialty?: string;
  content: string;
  placeholders?: SmartTextPlaceholder[];
  shortcuts?: string[];
  tags?: string[];
  isCustom?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmartTextPlaceholder {
  key: string;
  label: string;
  type: 'text' | 'date' | 'time' | 'number' | 'select' | 'vitals' | 'medication';
  options?: string[];
  defaultValue?: string;
  required?: boolean;
}

export interface SmartTextMacro {
  trigger: string;
  expansion: string;
  category?: string;
  contextual?: boolean;
}

export interface SmartTextAutoComplete {
  term: string;
  suggestions: string[];
  category: string;
  frequency: number;
}

const DB_NAME = 'OmniCareOffline';
const TEMPLATES_STORE = 'note_templates';
const MACROS_STORE = 'smarttext_macros';
const AUTOCOMPLETE_STORE = 'smarttext_autocomplete';

export class OfflineSmartTextService {
  private db: IDBDatabase | null = null;
  private macrosCache: Map<string, SmartTextMacro> = new Map();
  private templatesCache: Map<string, SmartTextTemplate> = new Map();
  private autoCompleteCache: Map<string, SmartTextAutoComplete[]> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeDB();
      this.loadDefaultTemplates();
      this.loadDefaultMacros();
    }
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2); // Increment version for new stores

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.loadCaches();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Templates store
        if (!db.objectStoreNames.contains(TEMPLATES_STORE)) {
          const templatesStore = db.createObjectStore(TEMPLATES_STORE, { keyPath: 'id' });
          templatesStore.createIndex('category', 'category', { unique: false });
          templatesStore.createIndex('specialty', 'specialty', { unique: false });
          templatesStore.createIndex('name', 'name', { unique: false });
        }

        // Macros store
        if (!db.objectStoreNames.contains(MACROS_STORE)) {
          const macrosStore = db.createObjectStore(MACROS_STORE, { keyPath: 'trigger' });
          macrosStore.createIndex('category', 'category', { unique: false });
        }

        // AutoComplete store
        if (!db.objectStoreNames.contains(AUTOCOMPLETE_STORE)) {
          const autoCompleteStore = db.createObjectStore(AUTOCOMPLETE_STORE, { keyPath: 'term' });
          autoCompleteStore.createIndex('category', 'category', { unique: false });
          autoCompleteStore.createIndex('frequency', 'frequency', { unique: false });
        }
      };
    });
  }

  private async loadCaches(): Promise<void> {
    if (!this.db) return;

    // Load macros into cache
    const macrosTransaction = this.db.transaction([MACROS_STORE], 'readonly');
    const macrosStore = macrosTransaction.objectStore(MACROS_STORE);
    const macros = await new Promise<SmartTextMacro[]>((resolve, reject) => {
      const request = macrosStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    macros.forEach(macro => this.macrosCache.set(macro.trigger, macro));

    // Load templates into cache
    const templatesTransaction = this.db.transaction([TEMPLATES_STORE], 'readonly');
    const templatesStore = templatesTransaction.objectStore(TEMPLATES_STORE);
    const templates = await new Promise<SmartTextTemplate[]>((resolve, reject) => {
      const request = templatesStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    templates.forEach(template => this.templatesCache.set(template.id, template));
  }

  // ===============================
  // TEMPLATE MANAGEMENT
  // ===============================

  private async loadDefaultTemplates(): Promise<void> {
    const defaultTemplates: SmartTextTemplate[] = [
      {
        id: 'progress-note-template',
        name: 'Progress Note Template',
        category: 'progress',
        content: `CHIEF COMPLAINT: {{chief_complaint}}

HISTORY OF PRESENT ILLNESS:
{{hpi}}

REVIEW OF SYSTEMS:
Constitutional: {{ros_constitutional}}
Cardiovascular: {{ros_cardiovascular}}
Respiratory: {{ros_respiratory}}
Gastrointestinal: {{ros_gi}}
Genitourinary: {{ros_gu}}
Musculoskeletal: {{ros_msk}}
Neurological: {{ros_neuro}}
Psychiatric: {{ros_psych}}

PHYSICAL EXAMINATION:
Vital Signs: BP {{bp}}, HR {{hr}}, RR {{rr}}, Temp {{temp}}, O2 Sat {{o2sat}}%
General: {{pe_general}}
HEENT: {{pe_heent}}
Cardiovascular: {{pe_cv}}
Respiratory: {{pe_resp}}
Abdomen: {{pe_abd}}
Extremities: {{pe_ext}}
Neurological: {{pe_neuro}}

ASSESSMENT AND PLAN:
{{assessment_plan}}

FOLLOW-UP: {{follow_up}}`,
        placeholders: [
          { key: 'chief_complaint', label: 'Chief Complaint', type: 'text', required: true },
          { key: 'hpi', label: 'History of Present Illness', type: 'text', required: true },
          { key: 'bp', label: 'Blood Pressure', type: 'vitals' },
          { key: 'hr', label: 'Heart Rate', type: 'vitals' },
          { key: 'assessment_plan', label: 'Assessment and Plan', type: 'text', required: true }
        ],
        shortcuts: ['pnote', 'progress'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'soap-note-template',
        name: 'SOAP Note Template',
        category: 'progress',
        content: `SUBJECTIVE:
{{subjective}}

OBJECTIVE:
Vital Signs: {{vitals}}
Physical Exam: {{physical_exam}}
Lab Results: {{lab_results}}

ASSESSMENT:
{{assessment}}

PLAN:
{{plan}}`,
        placeholders: [
          { key: 'subjective', label: 'Subjective', type: 'text', required: true },
          { key: 'vitals', label: 'Vital Signs', type: 'vitals' },
          { key: 'assessment', label: 'Assessment', type: 'text', required: true },
          { key: 'plan', label: 'Plan', type: 'text', required: true }
        ],
        shortcuts: ['soap'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'procedure-note-template',
        name: 'Procedure Note Template',
        category: 'procedure',
        content: `PROCEDURE: {{procedure_name}}
DATE: {{procedure_date}}
INDICATION: {{indication}}

PRE-PROCEDURE DIAGNOSIS: {{pre_diagnosis}}
POST-PROCEDURE DIAGNOSIS: {{post_diagnosis}}

ANESTHESIA: {{anesthesia}}
ESTIMATED BLOOD LOSS: {{ebl}}

PROCEDURE DETAILS:
{{procedure_details}}

COMPLICATIONS: {{complications}}

DISPOSITION: {{disposition}}`,
        placeholders: [
          { key: 'procedure_name', label: 'Procedure Name', type: 'text', required: true },
          { key: 'procedure_date', label: 'Date', type: 'date', required: true },
          { key: 'indication', label: 'Indication', type: 'text', required: true },
          { key: 'procedure_details', label: 'Procedure Details', type: 'text', required: true }
        ],
        shortcuts: ['proc', 'procedure'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Store default templates
    for (const template of defaultTemplates) {
      await this.saveTemplate(template);
    }
  }

  public async getTemplates(category?: string, specialty?: string): Promise<SmartTextTemplate[]> {
    if (!this.db) await this.initializeDB();

    let templates = Array.from(this.templatesCache.values());

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    if (specialty) {
      templates = templates.filter(t => t.specialty === specialty);
    }

    return templates.sort((a, b) => a.name.localeCompare(b.name));
  }

  public async getTemplate(id: string): Promise<SmartTextTemplate | null> {
    return this.templatesCache.get(id) || null;
  }

  public async saveTemplate(template: SmartTextTemplate): Promise<void> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([TEMPLATES_STORE], 'readwrite');
    const store = transaction.objectStore(TEMPLATES_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(template);
      request.onsuccess = () => {
        this.templatesCache.set(template.id, template);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async createCustomTemplate(
    name: string,
    content: string,
    category: string,
    placeholders?: SmartTextPlaceholder[]
  ): Promise<SmartTextTemplate> {
    const template: SmartTextTemplate = {
      id: generateId(),
      name,
      category,
      content,
      placeholders,
      isCustom: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.saveTemplate(template);
    return template;
  }

  // ===============================
  // MACRO MANAGEMENT
  // ===============================

  private async loadDefaultMacros(): Promise<void> {
    const defaultMacros: SmartTextMacro[] = [
      // Vital signs macros
      { trigger: '.bp', expansion: 'Blood pressure: ___/___ mmHg', category: 'vitals' },
      { trigger: '.hr', expansion: 'Heart rate: ___ bpm', category: 'vitals' },
      { trigger: '.temp', expansion: 'Temperature: ___°F', category: 'vitals' },
      { trigger: '.o2', expansion: 'O2 saturation: ___%', category: 'vitals' },
      { trigger: '.vitals', expansion: 'BP: ___/___ mmHg, HR: ___ bpm, RR: ___ bpm, Temp: ___°F, O2 Sat: ___%', category: 'vitals' },

      // Physical exam macros
      { trigger: '.wnl', expansion: 'within normal limits', category: 'exam' },
      { trigger: '.nad', expansion: 'no acute distress', category: 'exam' },
      { trigger: '.ctab', expansion: 'clear to auscultation bilaterally', category: 'exam' },
      { trigger: '.rrr', expansion: 'regular rate and rhythm', category: 'exam' },
      { trigger: '.s1s2', expansion: 'normal S1 and S2, no murmurs, rubs, or gallops', category: 'exam' },
      { trigger: '.abd', expansion: 'soft, non-tender, non-distended, normal bowel sounds', category: 'exam' },
      { trigger: '.neuro', expansion: 'alert and oriented x3, cranial nerves II-XII intact', category: 'exam' },

      // Common phrases
      { trigger: '.hpi', expansion: 'The patient is a ___-year-old ___ who presents with ___', category: 'common' },
      { trigger: '.ros', expansion: 'Review of systems is negative except as noted in HPI', category: 'common' },
      { trigger: '.followup', expansion: 'Follow up in ___ weeks/months', category: 'common' },
      { trigger: '.dc', expansion: 'Discharge to home with instructions', category: 'common' },
      { trigger: '.nka', expansion: 'No known allergies', category: 'common' },
      { trigger: '.nkda', expansion: 'No known drug allergies', category: 'common' },

      // Medication macros
      { trigger: '.tylenol', expansion: 'Acetaminophen 500mg PO q6h PRN pain', category: 'medication' },
      { trigger: '.ibu', expansion: 'Ibuprofen 4ResourceHistoryTablemg PO q6h PRN pain', category: 'medication' },
      { trigger: '.abx', expansion: 'Antibiotics as prescribed', category: 'medication' },

      // Time-based macros
      { trigger: '.today', expansion: new Date().toLocaleDateString(), category: 'time', contextual: true },
      { trigger: '.now', expansion: new Date().toLocaleTimeString(), category: 'time', contextual: true }
    ];

    // Store default macros
    for (const macro of defaultMacros) {
      await this.saveMacro(macro);
    }
  }

  public async saveMacro(macro: SmartTextMacro): Promise<void> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([MACROS_STORE], 'readwrite');
    const store = transaction.objectStore(MACROS_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(macro);
      request.onsuccess = () => {
        this.macrosCache.set(macro.trigger, macro);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  public getMacro(trigger: string): SmartTextMacro | undefined {
    return this.macrosCache.get(trigger);
  }

  public getAllMacros(): SmartTextMacro[] {
    return Array.from(this.macrosCache.values());
  }

  public expandMacro(text: string): { expanded: boolean; result: string } {
    // Check for contextual macros first
    if (text === '.today') {
      return {
        expanded: true,
        result: new Date().toLocaleDateString()
      };
    }
    if (text === '.now') {
      return {
        expanded: true,
        result: new Date().toLocaleTimeString()
      };
    }

    const macro = this.macrosCache.get(text);
    if (macro) {
      return {
        expanded: true,
        result: macro.expansion
      };
    }

    return { expanded: false, result: text };
  }

  // ===============================
  // AUTOCOMPLETE
  // ===============================

  public async updateAutoComplete(term: string, category: string): Promise<void> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([AUTOCOMPLETE_STORE], 'readwrite');
    const store = transaction.objectStore(AUTOCOMPLETE_STORE);
    
    const existing = await new Promise<SmartTextAutoComplete | null>((resolve, reject) => {
      const request = store.get(term);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const autoComplete: SmartTextAutoComplete = existing ? {
      ...existing,
      frequency: existing.frequency + 1
    } : {
      term,
      suggestions: [],
      category,
      frequency: 1
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(autoComplete);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getAutoCompleteSuggestions(
    prefix: string, 
    category?: string, 
    limit: number = 10
  ): Promise<string[]> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([AUTOCOMPLETE_STORE], 'readonly');
    const store = transaction.objectStore(AUTOCOMPLETE_STORE);
    const index = store.index('frequency');
    
    const allTerms = await new Promise<SmartTextAutoComplete[]>((resolve, reject) => {
      const request = index.openCursor(null, 'prev'); // Sort by frequency descending
      const results: SmartTextAutoComplete[] = [];
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const term = cursor.value;
          if (term.term.toLowerCase().startsWith(prefix.toLowerCase()) &&
              (!category || term.category === category)) {
            results.push(term);
          }
          if (results.length < limit) {
            cursor.continue();
          } else {
            resolve(results);
          }
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });

    return allTerms.map(t => t.term);
  }

  // ===============================
  // TEMPLATE PROCESSING
  // ===============================

  public processTemplate(
    template: SmartTextTemplate, 
    values: Record<string, string>
  ): string {
    let content = template.content;

    // Replace placeholders
    if (template.placeholders) {
      template.placeholders.forEach(placeholder => {
        const value = values[placeholder.key] || placeholder.defaultValue || '';
        const regex = new RegExp(`{{${placeholder.key}}}`, 'g');
        content = content.replace(regex, value);
      });
    }

    // Remove any remaining placeholders
    content = content.replace(/{{[^}]+}}/g, '___');

    return content;
  }

  public extractPlaceholders(content: string): string[] {
    const regex = /{{([^}]+)}}/g;
    const placeholders: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      placeholders.push(match[1]);
    }

    return placeholders;
  }

  // ===============================
  // SMART SUGGESTIONS
  // ===============================

  public async getContextualSuggestions(
    noteType: string,
    currentText: string,
    patientContext?: {
      age?: number;
      gender?: string;
      conditions?: string[];
      medications?: string[];
    }
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Based on note type
    switch (noteType) {
      case 'progress':
        if (currentText.endsWith('ASSESSMENT:')) {
          suggestions.push(
            'Stable, improving as expected',
            'Condition unchanged from prior visit',
            'New onset symptoms requiring further evaluation'
          );
        }
        break;
      case 'procedure':
        if (currentText.endsWith('COMPLICATIONS:')) {
          suggestions.push(
            'None',
            'Minor bleeding, controlled with pressure',
            'No immediate complications'
          );
        }
        break;
    }

    // Based on patient context
    if (patientContext) {
      if (patientContext.age && patientContext.age > 65) {
        suggestions.push('Consider age-related considerations');
      }
      if (patientContext.conditions?.includes('diabetes')) {
        suggestions.push('Monitor blood glucose levels');
      }
    }

    return suggestions;
  }

  // ===============================
  // CLEANUP
  // ===============================

  public async cleanup(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.macrosCache.clear();
    this.templatesCache.clear();
    this.autoCompleteCache.clear();
  }
}

// Export singleton instance
export const offlineSmartTextService = new OfflineSmartTextService();