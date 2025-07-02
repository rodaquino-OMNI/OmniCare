/**
 * @jest-environment jsdom
 */

import { SmartTextService, SmartTextExpansion } from '../smarttext.service';

describe('SmartTextService', () => {
  let smartTextService: SmartTextService;

  beforeEach(() => {
    smartTextService = new SmartTextService();
  });

  describe('Initialization', () => {
    it('should initialize with default medical expansions', () => {
      const expansions = smartTextService.getExpansions();
      expect(expansions.length).toBeGreaterThan(0);
      
      // Check for some common medical abbreviations
      const bpExpansion = expansions.find(exp => exp.abbreviation === 'bp');
      expect(bpExpansion).toBeDefined();
      expect(bpExpansion?.expansion).toBe('blood pressure');
      expect(bpExpansion?.category).toBe('medical');
    });

    it('should have all default medical abbreviations', () => {
      const expansions = smartTextService.getExpansions();
      const abbreviations = expansions.map(exp => exp.abbreviation);
      
      const expectedAbbreviations = [
        'bp', 'hr', 'temp', 'resp', 'pt', 'hx', 'px', 'dx', 'tx', 'rx'
      ];
      
      expectedAbbreviations.forEach(abbrev => {
        expect(abbreviations).toContain(abbrev);
      });
    });

    it('should categorize expansions correctly', () => {
      const expansions = smartTextService.getExpansions();
      
      const medicalExpansions = expansions.filter(exp => exp.category === 'medical');
      const clinicalExpansions = expansions.filter(exp => exp.category === 'clinical');
      
      expect(medicalExpansions.length).toBeGreaterThan(0);
      expect(clinicalExpansions.length).toBeGreaterThan(0);
      
      // Verify specific categorizations
      const bpExpansion = expansions.find(exp => exp.abbreviation === 'bp');
      const ptExpansion = expansions.find(exp => exp.abbreviation === 'pt');
      
      expect(bpExpansion?.category).toBe('medical');
      expect(ptExpansion?.category).toBe('clinical');
    });
  });

  describe('Text Processing', () => {
    it('should expand simple abbreviations', async () => {
      const input = 'The pt has high bp.';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.processedText).toBe('The patient has high blood pressure.');
      expect(result.expansions).toHaveLength(2);
      expect(result.expansions.map(exp => exp.abbreviation)).toContain('pt');
      expect(result.expansions.map(exp => exp.abbreviation)).toContain('bp');
    });

    it('should handle multiple occurrences of same abbreviation', async () => {
      const input = 'pt bp is 120/80, pt hr is 72';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.processedText).toBe('patient blood pressure is 120/80, patient heart rate is 72');
      expect(result.expansions).toHaveLength(3); // pt, bp, hr
    });

    it('should preserve case in expansions', async () => {
      const input = 'Check BP and HR for the PT.';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.processedText).toBe('Check blood pressure and heart rate for the patient.');
    });

    it('should handle text with no abbreviations', async () => {
      const input = 'Patient appears well and comfortable.';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.processedText).toBe(input);
      expect(result.expansions).toHaveLength(0);
    });

    it('should handle empty text', async () => {
      const input = '';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.processedText).toBe('');
      expect(result.expansions).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should handle text with punctuation', async () => {
      const input = 'Pt presents with elevated bp, increased hr, and high temp.';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.processedText).toBe('patient presents with elevated blood pressure, increased heart rate, and high temperature.');
      expect(result.expansions).toHaveLength(4); // pt, bp, hr, temp
    });

    it('should not expand partial matches', async () => {
      const input = 'Support the patient thoroughly.';
      const result = await smartTextService.processSmartText(input);
      
      // Should not expand "support" even though it contains "pt"
      expect(result.processedText).toBe(input);
      expect(result.expansions).toHaveLength(0);
    });

    it('should handle word boundaries correctly', async () => {
      const input = 'The pt\'s bp is normal.';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.processedText).toBe('The patient\'s blood pressure is normal.');
      expect(result.expansions).toHaveLength(2);
    });
  });

  describe('Smart Suggestions', () => {
    it('should suggest vital signs documentation when "vital" is mentioned', async () => {
      const input = 'Review vital signs';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.suggestions).toContain('Consider documenting all vital signs');
    });

    it('should suggest pain scale documentation when "pain" is mentioned', async () => {
      const input = 'Patient complains of chest pain';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.suggestions).toContain('Document pain scale rating (1-10)');
    });

    it('should handle case-insensitive suggestions', async () => {
      const input1 = 'VITAL signs are stable';
      const input2 = 'Severe PAIN reported';
      
      const result1 = await smartTextService.processSmartText(input1);
      const result2 = await smartTextService.processSmartText(input2);
      
      expect(result1.suggestions).toContain('Consider documenting all vital signs');
      expect(result2.suggestions).toContain('Document pain scale rating (1-10)');
    });

    it('should provide multiple suggestions when applicable', async () => {
      const input = 'Patient has vital signs showing pain levels';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.suggestions).toContain('Consider documenting all vital signs');
      expect(result.suggestions).toContain('Document pain scale rating (1-10)');
      expect(result.suggestions).toHaveLength(2);
    });

    it('should not provide suggestions for unrelated text', async () => {
      const input = 'Patient scheduled for follow-up appointment';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('Custom Expansions', () => {
    it('should allow adding custom expansions', () => {
      const customExpansion: SmartTextExpansion = {
        abbreviation: 'sob',
        expansion: 'shortness of breath',
        category: 'medical'
      };
      
      smartTextService.addExpansion(customExpansion);
      
      const expansions = smartTextService.getExpansions();
      const added = expansions.find(exp => exp.abbreviation === 'sob');
      
      expect(added).toBeDefined();
      expect(added?.expansion).toBe('shortness of breath');
      expect(added?.category).toBe('medical');
    });

    it('should use custom expansions in text processing', async () => {
      const customExpansion: SmartTextExpansion = {
        abbreviation: 'sob',
        expansion: 'shortness of breath',
        category: 'medical'
      };
      
      smartTextService.addExpansion(customExpansion);
      
      const input = 'Patient reports sob after exercise.';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.processedText).toBe('Patient reports shortness of breath after exercise.');
      expect(result.expansions).toHaveLength(1);
      expect(result.expansions[0].abbreviation).toBe('sob');
    });

    it('should overwrite existing expansions when adding duplicates', () => {
      const originalExpansions = smartTextService.getExpansions();
      const originalBpCount = originalExpansions.filter(exp => exp.abbreviation === 'bp').length;
      
      const customExpansion: SmartTextExpansion = {
        abbreviation: 'bp',
        expansion: 'blood pressure reading',
        category: 'clinical'
      };
      
      smartTextService.addExpansion(customExpansion);
      
      const newExpansions = smartTextService.getExpansions();
      const newBpExpansions = newExpansions.filter(exp => exp.abbreviation === 'bp');
      
      expect(newBpExpansions).toHaveLength(originalBpCount);
      expect(newBpExpansions[0].expansion).toBe('blood pressure reading');
      expect(newBpExpansions[0].category).toBe('clinical');
    });
  });

  describe('Search Functionality', () => {
    it('should search expansions by abbreviation', () => {
      const results = smartTextService.searchExpansions('bp');
      
      expect(results.length).toBeGreaterThan(0);
      const bpResult = results.find(exp => exp.abbreviation === 'bp');
      expect(bpResult).toBeDefined();
      expect(bpResult?.expansion).toBe('blood pressure');
    });

    it('should search expansions by expansion text', () => {
      const results = smartTextService.searchExpansions('blood pressure');
      
      expect(results.length).toBeGreaterThan(0);
      const bpResult = results.find(exp => exp.expansion === 'blood pressure');
      expect(bpResult).toBeDefined();
      expect(bpResult?.abbreviation).toBe('bp');
    });

    it('should perform case-insensitive search', () => {
      const results1 = smartTextService.searchExpansions('BP');
      const results2 = smartTextService.searchExpansions('bp');
      const results3 = smartTextService.searchExpansions('BLOOD PRESSURE');
      
      expect(results1.length).toBeGreaterThan(0);
      expect(results2.length).toBeGreaterThan(0);
      expect(results3.length).toBeGreaterThan(0);
      
      expect(results1).toEqual(results2);
    });

    it('should return partial matches', () => {
      const results = smartTextService.searchExpansions('pressure');
      
      expect(results.length).toBeGreaterThan(0);
      const bpResult = results.find(exp => exp.expansion.includes('blood pressure'));
      expect(bpResult).toBeDefined();
    });

    it('should return empty array for no matches', () => {
      const results = smartTextService.searchExpansions('xyz123');
      expect(results).toHaveLength(0);
    });

    it('should handle empty search query', () => {
      const results = smartTextService.searchExpansions('');
      expect(results).toHaveLength(0);
    });

    it('should search in abbreviations and expansions simultaneously', () => {
      // Add custom expansion to test
      smartTextService.addExpansion({
        abbreviation: 'test',
        expansion: 'blood test result',
        category: 'medical'
      });
      
      const results = smartTextService.searchExpansions('blood');
      
      // Should find both 'bp' (blood pressure) and 'test' (blood test result)
      expect(results.length).toBeGreaterThanOrEqual(2);
      
      const abbreviations = results.map(r => r.abbreviation);
      expect(abbreviations).toContain('bp');
      expect(abbreviations).toContain('test');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in text', async () => {
      const input = 'Pt\'s bp = 120/80 mmHg; hr = 72 bpm.';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.processedText).toBe('patient\'s blood pressure = 120/80 mmHg; heart rate = 72 bpm.');
      expect(result.expansions).toHaveLength(3); // pt, bp, hr
    });

    it('should handle numbers and abbreviations', async () => {
      const input = 'BP 120/80, HR 72, Temp 98.6F';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.processedText).toBe('blood pressure 120/80, heart rate 72, temperature 98.6F');
    });

    it('should handle text with line breaks', async () => {
      const input = 'Patient History:\n- High bp\n- Normal hr\n- Recent hx of diabetes';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.processedText).toBe('Patient History:\n- High blood pressure\n- Normal heart rate\n- Recent history of diabetes');
      expect(result.expansions).toHaveLength(3); // bp, hr, hx
    });

    it('should handle very long text', async () => {
      const longText = Array(100).fill('The pt has normal bp and hr.').join(' ');
      const result = await smartTextService.processSmartText(longText);
      
      expect(result.processedText).toContain('patient');
      expect(result.processedText).toContain('blood pressure');
      expect(result.processedText).toContain('heart rate');
      expect(result.expansions.length).toBeGreaterThan(0);
    });

    it('should handle text with only whitespace', async () => {
      const input = '   \n\t  ';
      const result = await smartTextService.processSmartText(input);
      
      expect(result.processedText).toBe(input);
      expect(result.expansions).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should process text efficiently', async () => {
      const start = performance.now();
      
      const input = 'Pt presents with elevated bp, increased hr, high temp, and abnormal resp rate. Hx shows previous dx of hypertension. Current tx includes rx for ACE inhibitor.';
      const result = await smartTextService.processSmartText(input);
      
      const end = performance.now();
      const processingTime = end - start;
      
      expect(processingTime).toBeLessThan(100); // Should process in under 100ms
      expect(result.expansions.length).toBeGreaterThan(5);
    });

    it('should handle multiple concurrent requests', async () => {
      const inputs = [
        'Pt has high bp',
        'Check hr and temp',
        'Review hx and px',
        'Confirm dx and tx plan',
        'Update rx as needed'
      ];
      
      const promises = inputs.map(input => smartTextService.processSmartText(input));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.processedText).toBeDefined();
        expect(result.expansions).toBeDefined();
        expect(result.suggestions).toBeDefined();
      });
    });
  });
});