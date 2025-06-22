/**
 * SmartText Service
 * Provides intelligent text processing and expansion for clinical notes
 */

export interface SmartTextExpansion {
  abbreviation: string;
  expansion: string;
  category: 'medical' | 'general' | 'clinical';
}

export interface SmartTextResult {
  processedText: string;
  expansions: SmartTextExpansion[];
  suggestions: string[];
}

export class SmartTextService {
  private expansions: Map<string, SmartTextExpansion> = new Map();

  constructor() {
    this.initializeExpansions();
  }

  private initializeExpansions() {
    // Common medical abbreviations
    const medicalExpansions: SmartTextExpansion[] = [
      { abbreviation: 'bp', expansion: 'blood pressure', category: 'medical' },
      { abbreviation: 'hr', expansion: 'heart rate', category: 'medical' },
      { abbreviation: 'temp', expansion: 'temperature', category: 'medical' },
      { abbreviation: 'resp', expansion: 'respiratory rate', category: 'medical' },
      { abbreviation: 'pt', expansion: 'patient', category: 'clinical' },
      { abbreviation: 'hx', expansion: 'history', category: 'clinical' },
      { abbreviation: 'px', expansion: 'physical examination', category: 'clinical' },
      { abbreviation: 'dx', expansion: 'diagnosis', category: 'clinical' },
      { abbreviation: 'tx', expansion: 'treatment', category: 'clinical' },
      { abbreviation: 'rx', expansion: 'prescription', category: 'clinical' },
    ];

    medicalExpansions.forEach(exp => {
      this.expansions.set(exp.abbreviation.toLowerCase(), exp);
    });
  }

  async processSmartText(text: string): Promise<SmartTextResult> {
    let processedText = text;
    const expansions: SmartTextExpansion[] = [];
    const suggestions: string[] = [];

    // Find and expand abbreviations
    const words = text.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      const cleanWord = word.replace(/[^\w]/g, '');
      const expansion = this.expansions.get(cleanWord);
      
      if (expansion) {
        const regex = new RegExp(`\\b${cleanWord}\\b`, 'gi');
        processedText = processedText.replace(regex, expansion.expansion);
        expansions.push(expansion);
      }
    }

    // Generate suggestions based on context
    if (text.toLowerCase().includes('vital')) {
      suggestions.push('Consider documenting all vital signs');
    }
    if (text.toLowerCase().includes('pain')) {
      suggestions.push('Document pain scale rating (1-1ResourceHistoryTable)');
    }

    return {
      processedText,
      expansions,
      suggestions
    };
  }

  addExpansion(expansion: SmartTextExpansion): void {
    this.expansions.set(expansion.abbreviation.toLowerCase(), expansion);
  }

  getExpansions(): SmartTextExpansion[] {
    return Array.from(this.expansions.values());
  }

  searchExpansions(query: string): SmartTextExpansion[] {
    const queryLower = query.toLowerCase();
    return Array.from(this.expansions.values()).filter(
      exp => 
        exp.abbreviation.toLowerCase().includes(queryLower) ||
        exp.expansion.toLowerCase().includes(queryLower)
    );
  }
}