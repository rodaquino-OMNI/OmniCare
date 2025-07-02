/**
 * Template Service
 * Manages clinical note templates
 */

export interface NoteTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  tags: string[];
  isCustom: boolean;
  createdBy: string;
  createdAt: string;
}

export class TemplateService {
  private templates: NoteTemplate[] = [];

  async getTemplates(): Promise<NoteTemplate[]> {
    // Stub implementation - return empty array
    return this.templates;
  }

  async saveTemplate(template: Partial<NoteTemplate>): Promise<{ id: string }> {
    // Stub implementation - return fake ID
    return { id: 'template-' + Date.now() };
  }

  async deleteTemplate(id: string): Promise<boolean> {
    // Stub implementation - always succeed
    return true;
  }

  async searchTemplates(query: string): Promise<NoteTemplate[]> {
    // Stub implementation - return empty array
    return [];
  }
}

// Default export for convenience
export default new TemplateService();